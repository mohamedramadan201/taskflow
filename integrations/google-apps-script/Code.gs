/** TaskFlow Gmail metadata connector. Requires the Advanced Gmail service (v1). */
var TASKFLOW_KEYS = { baseUrl: "TASKFLOW_BASE_URL", connectorId: "TASKFLOW_CONNECTOR_ID", token: "TASKFLOW_CONNECTOR_TOKEN" };

function configureTaskFlow() {
  var properties = PropertiesService.getScriptProperties();
  var missing = Object.keys(TASKFLOW_KEYS).filter(function(key) { return !properties.getProperty(TASKFLOW_KEYS[key]); });
  if (missing.length) throw new Error("Missing Script Properties: " + missing.map(function(key) { return TASKFLOW_KEYS[key]; }).join(", ") + ". Open Project Settings, add the three TaskFlow Script Properties, then run configureTaskFlow again.");
  var result = testTaskFlowConnection();
  installTaskFlowTrigger();
  return result;
}

function installTaskFlowTrigger() {
  ScriptApp.getProjectTriggers().filter(function(trigger) { return trigger.getHandlerFunction() === "runTaskFlow" || trigger.getHandlerFunction() === "syncTaskFlow" || trigger.getHandlerFunction() === "processTaskFlowQueue"; }).forEach(function(trigger) { ScriptApp.deleteTrigger(trigger); });
  ScriptApp.newTrigger("runTaskFlow").timeBased().everyMinutes(1).create();
}

function testTaskFlowConnection() { return taskflowRequest_("sync-config", "get"); }

function runTaskFlow() {
  try { syncTaskFlow(); } catch (error) { console.error("TaskFlow Gmail sync failed", error); }
  try { processTaskFlowQueue(); } catch (error) { console.error("TaskFlow email delivery failed", error); }
}

function processTaskFlowQueue() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var result = taskflowRequest_("automation/claim", "get"), work = result.work || [], properties = PropertiesService.getScriptProperties();
    work.forEach(function(item) {
      var markerKey = "TASKFLOW_SENT_" + item.kind + "_" + item.id, marker = properties.getProperty(markerKey), markerAt = Number(marker || 0);
      if (markerAt && Date.now() - markerAt < 7 * 86400000) {
        taskflowRequest_("automation/result", "post", { kind: item.kind, id: item.id, success: true });
        return;
      }
      try {
        MailApp.sendEmail({ to: item.to, subject: item.subject, body: item.body, name: "TaskFlow" });
        properties.setProperty(markerKey, String(Date.now()));
        taskflowRequest_("automation/result", "post", { kind: item.kind, id: item.id, success: true });
        properties.deleteProperty(markerKey);
      } catch (error) {
        try { taskflowRequest_("automation/result", "post", { kind: item.kind, id: item.id, success: false, error: String(error && error.message || error).slice(0, 500) }); } catch (resultError) { console.error("TaskFlow delivery result failed", resultError); }
      }
    });
  } finally { lock.releaseLock(); }
}

function syncTaskFlow() {
  var config;
  try {
    config = taskflowRequest_("sync-config", "get");
    if (!config.enabled || !config.shouldSync) return;
    if (!config.historyId) {
      var profile = Gmail.Users.getProfile("me");
      taskflowRequest_("ingest", "post", { historyId: String(profile.historyId), emails: [] });
      return;
    }
    var changes = gmailChangesSince_(config.historyId);
    var changedMetadata = changes.messageIds.map(function(id) { return gmailMetadata_(id, true); }).filter(Boolean);
    var messages = changedMetadata.filter(function(item) { return !item.isSent && passesRules_(item, config.mailboxAddress, config.filters); }).map(function(item) { var copy = {}; Object.keys(item).forEach(function(key) { if (key !== "isSent") copy[key] = item[key]; }); return copy; });
    var threadIds = uniqueValues_(changedMetadata.map(function(item) { return item.gmailThreadId; }));
    var threadSnapshots = threadIds.map(gmailThreadMetadata_).filter(Boolean);
    if (!messages.length && !threadSnapshots.length) { taskflowRequest_("ingest", "post", { historyId: changes.historyId, emails: [], threadSnapshots: [] }); return; }
    for (var offset = 0; offset < messages.length; offset += 50) {
      var isLast = offset + 50 >= messages.length;
      taskflowRequest_("ingest", "post", { historyId: isLast ? changes.historyId : undefined, emails: messages.slice(offset, offset + 50), threadSnapshots: isLast ? threadSnapshots : [] });
    }
    if (!messages.length) taskflowRequest_("ingest", "post", { historyId: changes.historyId, emails: [], threadSnapshots: threadSnapshots });
  } catch (error) {
    try { taskflowRequest_("ingest", "post", { historyId: config && config.historyId, emails: [], error: String(error && error.message || error).slice(0, 500) }); } catch (_) {}
    throw error;
  }
}

function gmailChangesSince_(historyId) {
  var ids = {}, pageToken, latestHistoryId = historyId;
  try {
    do {
      var response = Gmail.Users.History.list("me", { startHistoryId: historyId, historyTypes: ["messageAdded"], maxResults: 500, pageToken: pageToken });
      (response.history || []).forEach(function(entry) { (entry.messagesAdded || []).forEach(function(added) { if (added.message && added.message.id) ids[added.message.id] = true; }); });
      latestHistoryId = String(response.historyId || latestHistoryId); pageToken = response.nextPageToken;
    } while (pageToken);
  } catch (error) {
    if (!/404|not found/i.test(String(error))) throw error;
    var recent = Gmail.Users.Messages.list("me", { maxResults: 100 });
    (recent.messages || []).forEach(function(message) { ids[message.id] = true; });
    latestHistoryId = String(Gmail.Users.getProfile("me").historyId);
  }
  return { messageIds: Object.keys(ids), historyId: latestHistoryId };
}

function gmailMetadata_(id, includeSent) {
  try {
    var message = Gmail.Users.Messages.get("me", id, { format: "metadata", metadataHeaders: ["From", "To", "Cc", "Delivered-To", "X-Original-To", "Subject", "Message-ID"] });
    var labels = message.labelIds || [];
    if (["SPAM", "TRASH", "DRAFT"].some(function(label) { return labels.indexOf(label) >= 0; })) return null;
    var isSent = labels.indexOf("SENT") >= 0;
    if (!includeSent && (labels.indexOf("INBOX") < 0 || isSent)) return null;
    var headers = {}; ((message.payload && message.payload.headers) || []).forEach(function(header) { var key = header.name.toLowerCase(); (headers[key] || (headers[key] = [])).push(header.value); });
    var from = parseAddresses_((headers.from || []).join(","))[0]; if (!from) return null;
    return { gmailMessageId: message.id, gmailThreadId: message.threadId, internetMessageId: first_(headers["message-id"]), senderAddress: from.address, senderName: from.name || null, toAddresses: addressValues_(headers.to), ccAddresses: addressValues_(headers.cc), deliveredTo: addressValues_((headers["delivered-to"] || []).concat(headers["x-original-to"] || [])), subject: first_(headers.subject) || "(No subject)", snippet: String(message.snippet || "").slice(0, 1000), receivedAt: new Date(Number(message.internalDate)).toISOString(), isSent: isSent };
  } catch (error) {
    if (/404|requested entity was not found|not found/i.test(String(error))) { console.warn("Skipping unavailable Gmail message " + id); return null; }
    throw error;
  }
}

function gmailThreadMetadata_(threadId) {
  try {
    var thread = Gmail.Users.Threads.get("me", threadId, { format: "metadata", metadataHeaders: ["From", "To", "Cc", "Subject"] });
    var messages = (thread.messages || []).map(function(message) {
      var headers = {}; ((message.payload && message.payload.headers) || []).forEach(function(header) { var key = header.name.toLowerCase(); (headers[key] || (headers[key] = [])).push(header.value); });
      var from = parseAddresses_((headers.from || []).join(","))[0];
      if (!from) return null;
      return { senderAddress: from.address, toAddresses: addressValues_(headers.to), ccAddresses: addressValues_(headers.cc), subject: first_(headers.subject) || "(No subject)", receivedAt: new Date(Number(message.internalDate)).toISOString(), isSent: (message.labelIds || []).indexOf("SENT") >= 0 };
    }).filter(Boolean);
    return { gmailThreadId: threadId, messages: messages };
  } catch (error) {
    if (/404|requested entity was not found|not found/i.test(String(error))) return null;
    throw error;
  }
}

function uniqueValues_(values) { var seen = {}, result = []; (values || []).forEach(function(value) { value = String(value || ""); if (value && !seen[value]) { seen[value] = true; result.push(value); } }); return result; }

function addressValues_(values) { return parseAddresses_((values || []).join(",")).map(function(item) { return item.address; }); }
function parseAddresses_(value) { var found = [], regex = /(?:"?([^"<,]+)"?\s*)?<([^<>\s]+@[^<>\s]+)>|([^\s,<>]+@[^\s,<>]+)/g, match; while ((match = regex.exec(value || ""))) found.push({ name: String(match[1] || "").trim(), address: String(match[2] || match[3]).toLowerCase() }); return found; }
function first_(values) { return values && values.length ? values[0] : null; }
function ruleMatches_(address, rule) { address = String(address || "").toLowerCase(); var value = String(rule.value || "").toLowerCase().replace(/^@/, ""); return rule.matchType === "EXACT" ? address === value : address.slice(address.lastIndexOf("@") + 1) === value; }
function passesRules_(email, mailbox, rules) { var recipients = email.toAddresses.concat(email.ccAddresses, email.deliveredTo, [mailbox]); var byField = { SENDER: [email.senderAddress], RECIPIENT: recipients }; return ["SENDER", "RECIPIENT"].every(function(field) { var fieldRules = (rules || []).filter(function(rule) { return rule.field === field; }); if (fieldRules.some(function(rule) { return rule.action === "EXCLUDE" && byField[field].some(function(address) { return ruleMatches_(address, rule); }); })) return false; var includes = fieldRules.filter(function(rule) { return rule.action === "INCLUDE"; }); return !includes.length || includes.some(function(rule) { return byField[field].some(function(address) { return ruleMatches_(address, rule); }); }); }); }

function taskflowRequest_(path, method, body) {
  var properties = PropertiesService.getScriptProperties(), baseUrl = properties.getProperty(TASKFLOW_KEYS.baseUrl), connectorId = properties.getProperty(TASKFLOW_KEYS.connectorId), token = properties.getProperty(TASKFLOW_KEYS.token);
  if (!baseUrl || !connectorId || !token) throw new Error("TaskFlow connector is not configured.");
  baseUrl = String(baseUrl).trim().replace(/\/+$/, "");
  if (!/^https:\/\//i.test(baseUrl) || /^https:\/\/(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(baseUrl)) {
    throw new Error("TASKFLOW_BASE_URL must be a public HTTPS URL. localhost and private network addresses cannot be reached by Google Apps Script. Deploy TaskFlow or use a secure public tunnel, then update this Script Property.");
  }
  var options = { method: method, headers: { "x-taskflow-connector-token": token }, muteHttpExceptions: true };
  if (body) { options.contentType = "application/json"; options.payload = JSON.stringify(body); }
  var response = UrlFetchApp.fetch(baseUrl + "/api/email-connectors/" + encodeURIComponent(connectorId) + "/" + path, options), code = response.getResponseCode(), text = response.getContentText();
  if (code < 200 || code >= 300) throw new Error("TaskFlow returned " + code + ": " + text.slice(0, 300));
  return text ? JSON.parse(text) : {};
}

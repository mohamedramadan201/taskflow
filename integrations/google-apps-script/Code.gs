/** TaskFlow Gmail metadata connector. Requires the Advanced Gmail service (v1). */
var TASKFLOW_KEYS = { baseUrl: "TASKFLOW_BASE_URL", connectorId: "TASKFLOW_CONNECTOR_ID", token: "TASKFLOW_CONNECTOR_TOKEN" };
var BACKFILL_BATCH_SIZE_ = 25;
var BACKFILL_PAGE_SIZE_ = 100;
var GMAIL_QUOTA_BACKOFF_MS_ = 5 * 60 * 1000;

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
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try { syncTaskFlowLocked_(); } finally { lock.releaseLock(); }
}

function syncTaskFlowLocked_() {
  var config;
  try {
    config = taskflowRequest_("sync-config", "get");
    if (!config.enabled || !config.shouldSync) return;
    var quotaBackoffUntil = Number(PropertiesService.getScriptProperties().getProperty(quotaBackoffKey_(config)) || 0);
    if (quotaBackoffUntil && Date.now() < quotaBackoffUntil) return;
    var isBackfill = Boolean(config.syncRequestedAt || !config.historyId);
    if (isBackfill) {
      var batch = gmailLookbackBatch_(config);
      var backfillMetadata = batch.metadata;
      var messages = backfillMetadata.filter(function(item) { return !item.isSent && passesRules_(item, config.mailboxAddress, config.filters); }).map(stripSentFlag_);
      var threadSnapshots = monitorSnapshotsFor_(backfillMetadata, config);
      sendIngestBatches_(messages, threadSnapshots, batch.done ? batch.historyId : null, batch.done);
      if (batch.done) clearBackfillState_(config);
      clearQuotaBackoff_(config);
      return;
    }

    var changes = gmailChangesSince_(config.historyId);
    var messageIds = changes.messageIds || [];
    var changedMetadata = messageIds.map(function(id) { return gmailMetadata_(id, true); }).filter(Boolean);
    var seenMetadata = {};
    changedMetadata = changedMetadata.filter(function(item) { if (seenMetadata[item.gmailMessageId]) return false; seenMetadata[item.gmailMessageId] = true; return true; });
    var messages = changedMetadata.filter(function(item) { return !item.isSent && passesRules_(item, config.mailboxAddress, config.filters); }).map(stripSentFlag_);
    var threadSnapshots = monitorSnapshotsFor_(changedMetadata, config);
    sendIngestBatches_(messages, threadSnapshots, changes.historyId, true);
    clearQuotaBackoff_(config);
  } catch (error) {
    try { taskflowRequest_("ingest", "post", { historyId: config && config.historyId, emails: [], error: String(error && error.message || error).slice(0, 500) }); } catch (_) {}
    if (isGmailQuotaError_(error) && config) {
      PropertiesService.getScriptProperties().setProperty(quotaBackoffKey_(config), String(Date.now() + GMAIL_QUOTA_BACKOFF_MS_));
      return;
    }
    throw error;
  }
}

function gmailLookbackBatch_(config) {
  var properties = PropertiesService.getScriptProperties(), key = "TASKFLOW_BACKFILL_" + config.connectorId;
  var days = Math.max(1, Math.min(90, Number(config.monitor && config.monitor.lookbackDays) || 30));
  var syncKey = String(config.syncRequestedAt || "initial");
  var state = null;
  try { state = JSON.parse(properties.getProperty(key) || "null"); } catch (_) {}
  if (!state || state.syncKey !== syncKey || state.lookbackDays !== days) {
    state = { syncKey: syncKey, lookbackDays: days, cutoff: Date.now() - days * 86400000, pageToken: null, pendingIds: [], pageHasRecent: false, exhausted: false, historyId: String(config.historyId || Gmail.Users.getProfile("me").historyId) };
  }
  if (!state.pendingIds.length && !state.exhausted) {
    // Do not pass q here: this connector intentionally uses the Gmail
    // metadata scope, and Gmail rejects search queries with that scope.
    var options = { maxResults: BACKFILL_PAGE_SIZE_ };
    if (state.pageToken) options.pageToken = state.pageToken;
    var response = Gmail.Users.Messages.list("me", options);
    state.pendingIds = (response.messages || []).map(function(message) { return message && message.id; }).filter(Boolean);
    state.pageToken = response.nextPageToken || null;
    state.pageHasRecent = false;
    if (!state.pendingIds.length) state.exhausted = true;
  }
  var ids = state.pendingIds.splice(0, BACKFILL_BATCH_SIZE_), metadata = [];
  ids.forEach(function(id) {
    var item = gmailMetadata_(id, true);
    if (item && new Date(item.receivedAt).getTime() >= state.cutoff) { metadata.push(item); state.pageHasRecent = true; }
  });
  if (!state.pendingIds.length && (!state.pageHasRecent || !state.pageToken)) state.exhausted = true;
  var done = state.exhausted && !state.pendingIds.length;
  if (done) properties.deleteProperty(key); else properties.setProperty(key, JSON.stringify(state));
  return { metadata: metadata, done: done, historyId: state.historyId };
}

function clearBackfillState_(config) { PropertiesService.getScriptProperties().deleteProperty("TASKFLOW_BACKFILL_" + config.connectorId); }
function quotaBackoffKey_(config) { return "TASKFLOW_GMAIL_QUOTA_BACKOFF_" + config.connectorId; }
function clearQuotaBackoff_(config) { PropertiesService.getScriptProperties().deleteProperty(quotaBackoffKey_(config)); }
function isGmailQuotaError_(error) { return /quota exceeded|userRateLimitExceeded|rate limit|too many requests|units per minute/i.test(String(error && error.message || error)); }
function stripSentFlag_(item) { var copy = {}; Object.keys(item).forEach(function(key) { if (key !== "isSent") copy[key] = item[key]; }); return copy; }

function sendIngestBatches_(messages, threadSnapshots, historyId, complete) {
  var emailChunks = chunkValues_(messages, 50), snapshotChunks = chunkValues_(threadSnapshots, 50), batchCount = Math.max(emailChunks.length, snapshotChunks.length, 1);
  for (var batchIndex = 0; batchIndex < batchCount; batchIndex++) {
    var isLast = batchIndex + 1 === batchCount;
    taskflowRequest_("ingest", "post", { historyId: isLast && complete ? historyId : undefined, syncComplete: isLast && complete, emails: emailChunks[batchIndex] || [], threadSnapshots: snapshotChunks[batchIndex] || [] });
  }
}

function monitorSnapshotsFor_(metadata, config) {
  if (!config.monitor || !config.monitor.enabled) return [];
  var target = String(config.mailboxAddress || "").toLowerCase(), responders = (config.monitor.responderEmails || []).map(function(value) { return String(value || "").toLowerCase(); });
  var threadIds = uniqueValues_(metadata.filter(function(item) {
    var recipients = (item.toAddresses || []).concat(item.ccAddresses || []).map(function(value) { return String(value || "").toLowerCase(); });
    return recipients.indexOf(target) >= 0 || responders.indexOf(String(item.senderAddress || "").toLowerCase()) >= 0;
  }).map(function(item) { return item.gmailThreadId; }));
  return threadIds.map(function(threadId) {
    var snapshot = gmailThreadMetadata_(threadId);
    if (!snapshot) return null;
    snapshot.messages = snapshot.messages.filter(function(message) { return !excludedByRules_(message, config.filters) && !monitorMessageExcluded_(message, config.monitor); });
    return snapshot.messages.length ? snapshot : null;
  }).filter(Boolean);
}

function monitorMessageExcluded_(message, monitor) {
  var sender = String(message.senderAddress || "").toLowerCase();
  if ((monitor.excludedSenderEmails || []).some(function(value) { return sender === String(value || "").toLowerCase(); })) return true;
  var subject = String(message.subject || "").toLowerCase();
  return (monitor.excludedSubjectKeywords || []).some(function(value) { return subject.indexOf(String(value || "").toLowerCase()) >= 0; });
}

function excludedByRules_(email, rules) {
  var recipients = (email.toAddresses || []).concat(email.ccAddresses || []).map(function(value) { return String(value || "").toLowerCase(); });
  var byField = { SENDER: [String(email.senderAddress || "").toLowerCase()], RECIPIENT: recipients };
  return ["SENDER", "RECIPIENT"].some(function(field) { return (rules || []).some(function(rule) { return rule.action === "EXCLUDE" && rule.field === field && byField[field].some(function(address) { return ruleMatches_(address, rule); }); }); });
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
    var message = gmailMessageGet_(id, { format: "metadata", metadataHeaders: ["From", "To", "Cc", "Delivered-To", "X-Original-To", "Subject", "Message-ID"] });
    if (!message) return null;
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
    var thread = gmailThreadGet_(threadId, { format: "metadata", metadataHeaders: ["From", "To", "Cc", "Subject"] });
    if (!thread) return null;
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

function gmailMessageGet_(id, options) {
  var lastError, attempts = 3;
  for (var attempt = 0; attempt < attempts; attempt++) {
    try {
      return Gmail.Users.Messages.get("me", id, options);
    } catch (error) {
      lastError = error;
      var message = String(error && error.message || error);
      if (!/precondition|backend|temporarily unavailable|internal|timeout/i.test(message) || attempt === attempts - 1) break;
      Utilities.sleep(250 * (attempt + 1));
    }
  }
  var errorText = String(lastError && lastError.message || lastError);
  if (/404|requested entity was not found|not found|precondition/i.test(errorText)) {
    console.warn("Skipping unavailable Gmail message " + id + ": " + errorText.slice(0, 180));
    return null;
  }
  throw lastError;
}

function gmailThreadGet_(id, options) {
  var lastError, attempts = 3;
  for (var attempt = 0; attempt < attempts; attempt++) {
    try {
      return Gmail.Users.Threads.get("me", id, options);
    } catch (error) {
      lastError = error;
      var message = String(error && error.message || error);
      if (!/precondition|backend|temporarily unavailable|internal|timeout/i.test(message) || attempt === attempts - 1) break;
      Utilities.sleep(250 * (attempt + 1));
    }
  }
  var errorText = String(lastError && lastError.message || lastError);
  if (/404|requested entity was not found|not found|precondition/i.test(errorText)) {
    console.warn("Skipping unavailable Gmail thread " + id + ": " + errorText.slice(0, 180));
    return null;
  }
  throw lastError;
}

function uniqueValues_(values) { var seen = {}, result = []; (values || []).forEach(function(value) { value = String(value || ""); if (value && !seen[value]) { seen[value] = true; result.push(value); } }); return result; }
function chunkValues_(values, size) { var chunks = []; for (var offset = 0; offset < values.length; offset += size) chunks.push(values.slice(offset, offset + size)); return chunks; }

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

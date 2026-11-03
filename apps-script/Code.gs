/**
 * Notes app - Google Drive token keeper (Google Apps Script web app)
 *
 * Keeps your Google "refresh token" in this script's private properties and hands the notes app a fresh Drive
 * access token whenever it asks (with your key), so the app never has to ask you to reconnect every hour.
 *
 * Script properties to set (Project Settings -> Script properties):
 *   GOOGLE_CLIENT_ID      the OAuth Client ID the app already uses
 *   GOOGLE_CLIENT_SECRET  that client's secret
 *   APP_KEY               a long random password only you know (20+ characters)
 */
var SCOPE = 'https://www.googleapis.com/auth/drive.file';

function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k); }
function setProp_(k, v) { PropertiesService.getScriptProperties().setProperty(k, v); }
function delProp_(k) { PropertiesService.getScriptProperties().deleteProperty(k); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function page_(title, msg) {
  return HtmlService.createHtmlOutput('<meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:18px system-ui;max-width:520px;margin:12vh auto;padding:0 20px;line-height:1.5"><h2>' + title + '</h2><p>' + msg + '</p></body>')
    .setTitle(title);
}
function same_(a, b) {   // constant-time comparison
  a = String(a || ''); b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function post_(body) {
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', { method: 'post', payload: body, muteHttpExceptions: true });
  return JSON.parse(r.getContentText() || '{}');
}

function doGet(e) {
  var p = (e && e.parameter) || {}, redirect = ScriptApp.getService().getUrl(), cache = CacheService.getScriptCache();

  // 2) Google sends you back here with a one-time code
  if (p.code || p.error) {
    var okState = p.state && cache.get('state:' + p.state);
    if (!okState) return page_('Link expired', 'Start again from the notes app (Settings, Always-on connection).');
    cache.remove('state:' + p.state);
    if (!p.code) return page_('Not linked', 'Google did not give a code (' + p.error + ').');
    var j = post_({ code: p.code, client_id: prop_('GOOGLE_CLIENT_ID'), client_secret: prop_('GOOGLE_CLIENT_SECRET'), redirect_uri: redirect, grant_type: 'authorization_code' });
    if (!j.refresh_token) return page_('Not linked', 'Google did not return a refresh token. Remove this app at myaccount.google.com/permissions and try again.');
    setProp_('REFRESH', j.refresh_token);
    cache.put('access', JSON.stringify({ t: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 }), 3000);
    return page_('Google Drive linked', 'Done. You can close this tab and go back to the notes app.');
  }

  var action = p.action || '';
  if (!action) return page_('Notes token keeper', 'This web app is running. Open your notes app to use it.');
  if (!same_(p.key, prop_('APP_KEY'))) return action === 'start' ? page_('Not allowed', 'The key is wrong.') : json_({ ok: false, error: 'bad_key' });

  // 1) the app sends you here (with your key) to link Google Drive once
  if (action === 'start') {
    var state = Utilities.getUuid(); cache.put('state:' + state, '1', 600);
    var q = 'client_id=' + encodeURIComponent(prop_('GOOGLE_CLIENT_ID')) + '&redirect_uri=' + encodeURIComponent(redirect) + '&response_type=code&scope=' + encodeURIComponent(SCOPE) +
      '&access_type=offline&prompt=consent&state=' + state;
    var url = 'https://accounts.google.com/o/oauth2/v2/auth?' + q;
    return HtmlService.createHtmlOutput('<script>window.top.location.href=' + JSON.stringify(url) + ';</script><a href="' + url + '" target="_top">Continue to Google</a>');
  }
  if (action === 'status') return json_({ ok: true, linked: !!prop_('REFRESH') });
  if (action === 'disconnect') {
    var rt = prop_('REFRESH');
    if (rt) { try { UrlFetchApp.fetch('https://oauth2.googleapis.com/revoke?token=' + encodeURIComponent(rt), { method: 'post', muteHttpExceptions: true }); } catch (x) {} }
    delProp_('REFRESH'); cache.remove('access');
    return json_({ ok: true });
  }
  // 3) the app asks for a fresh access token
  if (action === 'token') {
    var refresh = prop_('REFRESH');
    if (!refresh) return json_({ ok: false, error: 'not_linked' });
    var c = cache.get('access'); c = c ? JSON.parse(c) : null;
    if (c && c.exp - Date.now() > 10 * 60000) return json_({ ok: true, access_token: c.t, expires_in: Math.floor((c.exp - Date.now()) / 1000) });
    var t = post_({ client_id: prop_('GOOGLE_CLIENT_ID'), client_secret: prop_('GOOGLE_CLIENT_SECRET'), refresh_token: refresh, grant_type: 'refresh_token' });
    if (!t.access_token) {
      if (t.error === 'invalid_grant') { delProp_('REFRESH'); cache.remove('access'); return json_({ ok: false, error: 'not_linked', detail: 'Google revoked the link' }); }
      return json_({ ok: false, error: 'google', detail: t.error || 'unknown' });
    }
    cache.put('access', JSON.stringify({ t: t.access_token, exp: Date.now() + (t.expires_in || 3600) * 1000 }), 3000);
    return json_({ ok: true, access_token: t.access_token, expires_in: t.expires_in || 3600 });
  }
  return json_({ ok: false, error: 'not_found' });
}

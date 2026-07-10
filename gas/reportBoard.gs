var ALLOWED_MODES = ['通常探索', '深い探索（120秒）'];
var BOARD_PATTERN = /^[A-Z0-9、,\s空]*$/;
var MAX_BOARD_LENGTH = 300;

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond(false);
  }

  if (!isValidPayload(payload)) {
    return respond(false);
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([new Date(), payload.mode, payload.board]);
  return respond(true);
}

function isValidPayload(payload) {
  if (!payload || typeof payload.board !== 'string' || typeof payload.mode !== 'string') {
    return false;
  }
  if (ALLOWED_MODES.indexOf(payload.mode) === -1) {
    return false;
  }
  if (payload.board.length > MAX_BOARD_LENGTH) {
    return false;
  }
  if (!BOARD_PATTERN.test(payload.board)) {
    return false;
  }
  return true;
}

function respond(ok) {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: ok }))
    .setMimeType(ContentService.MimeType.JSON);
}

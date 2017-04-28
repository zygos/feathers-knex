'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = errorHandler;

var _feathersErrors = require('feathers-errors');

var _feathersErrors2 = _interopRequireDefault(_feathersErrors);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function errorHandler(error) {
  var feathersError = error;

  // TODO (EK): Map PG, Oracle, etc. errors

  // NOTE: SQLState values from
  // https://dev.mysql.com/doc/connector-j/5.1/en/connector-j-reference-error-sqlstates.html

  if (error.sqlState && error.sqlState.length) {
    // remove SQLSTATE marker (#) and pad/truncate SQLSTATE to 5 chars
    var sqlState = ('00000' + error.sqlState.replace('#', '')).slice(-5);

    switch (sqlState.slice(0, 2)) {
      case '02':
        feathersError = new _feathersErrors2.default.NotFound(error);
        break;
      case '28':
        feathersError = new _feathersErrors2.default.Forbidden(error);
        break;
      case '08':
      case '0A':
      case '0K':
        feathersError = new _feathersErrors2.default.Unavailable(error);
        break;
      case '20':
      case '21':
      case '22':
      case '23':
      case '24':
      case '25':
      case '40':
      case '42':
      case '70':
        feathersError = new _feathersErrors2.default.BadRequest(error);
        break;
      default:
        feathersError = new _feathersErrors2.default.GeneralError(error);
    }
  }

  // NOTE (EK): Error codes taken from
  // https://www.sqlite.org/c3ref/c_abort.html

  if (error.code === 'SQLITE_ERROR') {
    switch (error.errno) {
      case 1:
      case 8:
      case 18:
      case 19:
      case 20:
        feathersError = new _feathersErrors2.default.BadRequest(error);
        break;
      case 2:
        feathersError = new _feathersErrors2.default.Unavailable(error);
        break;
      case 3:
      case 23:
        feathersError = new _feathersErrors2.default.Forbidden(error);
        break;
      case 12:
        feathersError = new _feathersErrors2.default.NotFound(error);
        break;
      default:
        feathersError = new _feathersErrors2.default.GeneralError(error);
        break;
    }
  }

  throw feathersError;
}
module.exports = exports['default'];
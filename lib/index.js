'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.default = init;

var _uberproto = require('uberproto');

var _uberproto2 = _interopRequireDefault(_uberproto);

var _feathersQueryFilters = require('feathers-query-filters');

var _feathersQueryFilters2 = _interopRequireDefault(_feathersQueryFilters);

var _isPlainObject = require('is-plain-object');

var _isPlainObject2 = _interopRequireDefault(_isPlainObject);

var _feathersErrors = require('feathers-errors');

var _errorHandler = require('./error-handler');

var _errorHandler2 = _interopRequireDefault(_errorHandler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var METHODS = {
  $or: 'orWhere',
  $ne: 'whereNot',
  $in: 'whereIn',
  $nin: 'whereNotIn'
};

var OPERATORS = {
  $lt: '<',
  $lte: '<=',
  $gt: '>',
  $gte: '>=',
  $like: 'like',
  $contains: '@>',
  $contained: '<@',
  $overlap: '&&'
};

// Create the service.

var Service = function () {
  function Service(options) {
    _classCallCheck(this, Service);

    if (!options) {
      throw new Error('Knex options have to be provided');
    }

    if (!options.Model) {
      throw new Error('You must provide a Model (the initialized knex object)');
    }

    if (typeof options.name !== 'string') {
      throw new Error('No table name specified.');
    }

    this.knex = options.Model;
    this.id = options.id || 'id';
    this.paginate = options.paginate || {};
    this.table = options.name;
    this.events = options.events || [];
  }

  // NOTE (EK): We need this method so that we return a new query
  // instance each time, otherwise it will reuse the same query.


  _createClass(Service, [{
    key: 'db',
    value: function db() {
      return this.knex(this.table);
    }
  }, {
    key: 'extend',
    value: function extend(obj) {
      return _uberproto2.default.extend(obj, this);
    }
  }, {
    key: 'knexify',
    value: function knexify(query, params, parentKey) {
      var _this = this;

      Object.keys(params || {}).forEach(function (key) {
        var value = params[key];

        if ((0, _isPlainObject2.default)(value)) {
          return _this.knexify(query, value, key);
        }

        // const self = this;
        var column = parentKey || key;
        var method = METHODS[key];
        var operator = OPERATORS[key] || '=';

        if (method) {
          if (key === '$or') {
            var self = _this;

            return value.forEach(function (condition) {
              query[method](function () {
                self.knexify(this, condition);
              });
            });
          }
          // eslint-disable-next-line no-useless-call
          return query[method].call(query, column, value);
        }

        return query.where(column, operator, value);
      });
    }
  }, {
    key: 'createQuery',
    value: function createQuery() {
      var paramsQuery = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      var _filter = (0, _feathersQueryFilters2.default)(paramsQuery),
          filters = _filter.filters,
          query = _filter.query;

      var q = this.db().select([this.table + '.*']);

      // $select uses a specific find syntax, so it has to come first.
      if (filters.$select) {
        var _db;

        q = (_db = this.db()).select.apply(_db, _toConsumableArray(filters.$select.concat(this.table + '.' + this.id)));
      }

      // build up the knex query out of the query params
      this.knexify(q, query);

      // Handle $sort
      if (filters.$sort) {
        Object.keys(filters.$sort).forEach(function (key) {
          q = q.orderBy(key, filters.$sort[key] === 1 ? 'asc' : 'desc');
        });
      }

      return q;
    }
  }, {
    key: '_find',
    value: function _find(params, count) {
      var getFilter = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : _feathersQueryFilters2.default;

      var _getFilter = getFilter(params.query || {}),
          filters = _getFilter.filters,
          query = _getFilter.query;

      var q = params.knex || this.createQuery(params.query);

      // Handle $limit
      if (filters.$limit) {
        q.limit(filters.$limit);
      }

      // Handle $skip
      if (filters.$skip) {
        q.offset(filters.$skip);
      }

      var executeQuery = function executeQuery(total) {
        return q.then(function (data) {
          return {
            total: total,
            limit: filters.$limit,
            skip: filters.$skip || 0,
            data: data
          };
        });
      };

      if (filters.$limit === 0) {
        executeQuery = function executeQuery(total) {
          return Promise.resolve({
            total: total,
            limit: filters.$limit,
            skip: filters.$skip || 0,
            data: []
          });
        };
      }

      if (count) {
        var countQuery = this.db().count(this.id + ' as total');

        this.knexify(countQuery, query);

        return countQuery.then(function (count) {
          return count[0].total;
        }).then(executeQuery);
      }

      return executeQuery().catch(_errorHandler2.default);
    }
  }, {
    key: 'find',
    value: function find(params) {
      var paginate = params && typeof params.paginate !== 'undefined' ? params.paginate : this.paginate;
      var result = this._find(params, !!paginate.default, function (query) {
        return (0, _feathersQueryFilters2.default)(query, paginate);
      });

      if (!paginate.default) {
        return result.then(function (page) {
          return page.data;
        });
      }

      return result;
    }
  }, {
    key: '_get',
    value: function _get(id, params) {
      var query = _extends({}, params.query);

      query[this.id] = id;

      return this._find(_extends({}, params, { query: query })).then(function (page) {
        if (page.data.length !== 1) {
          throw new _feathersErrors.errors.NotFound('No record found for id \'' + id + '\'');
        }

        return page.data[0];
      }).catch(_errorHandler2.default);
    }
  }, {
    key: 'get',
    value: function get() {
      return this._get.apply(this, arguments);
    }
  }, {
    key: '_create',
    value: function _create(data, params) {
      var _this2 = this;

      return this.db().insert(data, this.id).then(function (rows) {
        var id = typeof data[_this2.id] !== 'undefined' ? data[_this2.id] : rows[0];
        return _this2._get(id, params);
      }).catch(_errorHandler2.default);
    }
  }, {
    key: 'create',
    value: function create(data, params) {
      var _this3 = this;

      if (Array.isArray(data)) {
        return Promise.all(data.map(function (current) {
          return _this3._create(current, params);
        }));
      }

      return this._create(data, params);
    }
  }, {
    key: 'patch',
    value: function patch(id, raw, params) {
      var _this4 = this;

      var query = (0, _feathersQueryFilters2.default)(params.query || {}).query;
      var data = _extends({}, raw);
      var mapIds = function mapIds(page) {
        return page.data.map(function (current) {
          return current[_this4.id];
        });
      };

      // By default we will just query for the one id. For multi patch
      // we create a list of the ids of all items that will be changed
      // to re-query them after the update
      var ids = id === null ? this._find(params).then(mapIds) : Promise.resolve([id]);

      if (id !== null) {
        query[this.id] = id;
      }

      var q = this.db();

      this.knexify(q, query);

      delete data[this.id];

      return ids.then(function (idList) {
        var _query;

        // Create a new query that re-queries all ids that
        // were originally changed
        var findParams = _extends({}, params, {
          query: (_query = {}, _defineProperty(_query, _this4.id, { $in: idList }), _defineProperty(_query, '$select', params.query && params.query.$select), _query)
        });

        return q.update(data).then(function () {
          return _this4._find(findParams).then(function (page) {
            var items = page.data;

            if (id !== null) {
              if (items.length === 1) {
                return items[0];
              } else {
                throw new _feathersErrors.errors.NotFound('No record found for id \'' + id + '\'');
              }
            }

            return items;
          });
        });
      }).catch(_errorHandler2.default);
    }
  }, {
    key: 'update',
    value: function update(id, data, params) {
      var _this5 = this;

      if (Array.isArray(data)) {
        return Promise.reject(_feathersErrors.errors.BadRequest('Not replacing multiple records. Did you mean `patch`?'));
      }

      // NOTE (EK): First fetch the old record so
      // that we can fill any existing keys that the
      // client isn't updating with null;
      return this._get(id, params).then(function (oldData) {
        var newObject = {};

        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = Object.keys(oldData)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var key = _step.value;

            if (data[key] === undefined) {
              newObject[key] = null;
            } else {
              newObject[key] = data[key];
            }
          }

          // NOTE (EK): Delete id field so we don't update it
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }

        delete newObject[_this5.id];

        return _this5.db().where(_this5.id, id).update(newObject).then(function () {
          // NOTE (EK): Restore the id field so we can return it to the client
          newObject[_this5.id] = id;
          return newObject;
        });
      }).catch(_errorHandler2.default);
    }
  }, {
    key: 'remove',
    value: function remove(id, params) {
      var _this6 = this;

      params.query = params.query || {};

      // NOTE (EK): First fetch the record so that we can return
      // it when we delete it.
      if (id !== null) {
        params.query[this.id] = id;
      }

      return this._find(params).then(function (page) {
        var items = page.data;
        var query = _this6.db();

        _this6.knexify(query, params.query);

        return query.del().then(function () {
          if (id !== null) {
            if (items.length === 1) {
              return items[0];
            } else {
              throw new _feathersErrors.errors.NotFound('No record found for id \'' + id + '\'');
            }
          }

          return items;
        });
      }).catch(_errorHandler2.default);
    }
  }]);

  return Service;
}();

function init(options) {
  return new Service(options);
}

init.Service = Service;
module.exports = exports['default'];
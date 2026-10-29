const { OtpChallenge, OtpSendLimit } = require('../../dist/models/otpChallenge.model');

// Model boundary fixture: evaluates the conditional writes used by the service.
module.exports = function otpStore(t) {
  const stores = [];
  for (const Model of [OtpChallenge, OtpSendLimit]) {
    const rows = new Map(); stores.push(rows);
    const copy = value => value ? structuredClone(value) : null;
    const matches = (row, filter) => row && Object.entries(filter).every(([key, value]) => {
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        return Object.entries(value).every(([op, expected]) =>
          op === '$lt' ? row[key] < expected : op === '$lte' ? row[key] <= expected : op === '$gt' ? row[key] > expected : false);
      }
      return row[key] === value;
    });
    function update(row, change) {
      Object.assign(row, copy(change.$set) || {});
      for (const [key, value] of Object.entries(change.$inc || {})) row[key] += value;
    }
    t.mock.method(Model, 'findById', async id => copy(rows.get(id)));
    t.mock.method(Model, 'updateOne', async (filter, change, options = {}) => {
      let row = rows.get(filter._id);
      if (!row && options.upsert) {
        row = new Model({ _id: filter._id, ...change.$setOnInsert }).toObject(); rows.set(row._id, row);
      }
      if (!matches(row, filter)) return { modifiedCount: 0 };
      update(row, change); return { modifiedCount: 1 };
    });
    t.mock.method(Model, 'findOneAndUpdate', async (filter, change, options = {}) => {
      const row = rows.get(filter._id);
      if (!matches(row, filter)) return null;
      const before = copy(row); update(row, change);
      return options.new ? copy(row) : before;
    });
  }
  return { challenges: stores[0], limits: stores[1] };
};

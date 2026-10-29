const { User } = require('../../dist/models/user.model');
const jwt = require('../../dist/utils/jwt');
const { HttpError } = require('../../dist/utils/httpError');
exports.mockBookingTraveller = (t, changes = {}) => {
  const traveller = { _id: 'fixture-owner', roles: ['traveller'], status: 'active',
    isMobileVerified: true, mobileNumber: '919000000000', email: 'test@example.com', ...changes };
  t.mock.method(jwt, 'verifyAuthToken', token => {
    if (token !== 'fixture-owner-session') throw new HttpError(401, 'Auth session expired');
    return { userId: 'fixture-owner', roles: traveller.roles };
  });
  t.mock.method(User, 'findById', async () => traveller);
  return traveller;
};
exports.bookingRequest = (id, signedIn = true, extra = {}) => ({ params: { id }, query: {},
  headers: signedIn ? { authorization: 'Bearer fixture-owner-session' } : {}, ...extra });
exports.bookingResponse = () => ({ headers: {}, statusCode: 0,
  setHeader(key, value) { this.headers[key] = value; },
  status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });

// http://strongloop.com/strongblog/how-to-test-an-api-with-node-js/
console.log('start tests');

var should = require('chai').should(),
    supertest = require('supertest'),
    api = supertest('http://localhost:6805'),
    unifile = require('unifile'),
    app = express();

app.use(unifile.middleware(/* override default options here */));
app.listen(6805);

describe('Authentication', function() {

  it('errors if wrong basic auth', function(done) {
    api.get('/api/v1.0/dropbox/login/')
    .set('x-api-key', '123myapikey')
    .auth('incorrect', 'credentials')
    .expect(401, done)
  });
});
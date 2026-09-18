const https = require('https');

https.get('https://zrnnrnnzywqnvdmnpbws.supabase.co/rest/v1/', (res) => {
  console.log('Headers:', res.headers);
});

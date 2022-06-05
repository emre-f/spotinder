const express = require('express');
const router = express.Router();
const request = require('request');

const client_id = process.env.CLIENT_ID; // Your client id
const client_secret = process.env.CLIENT_SECRET; // Your secret
const redirect_uri = process.env.REDIRECT_URI || 'http://localhost:'; // Your redirect uri (depends on if heroku or not)
const AUTH_CALLBACK = '/auth/callback';

var generateRandomString = function(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  
    for (var i = 0; i < length; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

var stateKey = 'spotify_auth_state';

router.route('/')
    .get((req, res) => {
        var state = generateRandomString(16);
        res.cookie(stateKey, state);

        // your application requests authorization
        var scope = 'user-read-private user-read-email';

        let finalRedirectUri = ""
        if (redirect_uri === 'http://localhost:') {
            finalRedirectUri = redirect_uri + res.serverPort + AUTH_CALLBACK;
        } else {
            finalRedirectUri = redirect_uri + AUTH_CALLBACK;
        }

        const params = new URLSearchParams({
            response_type: 'code',
            client_id: client_id,
            scope: scope,
            redirect_uri: finalRedirectUri,
            state: state
        }).toString();

        res.redirect('https://accounts.spotify.com/authorize?' + params);
    })

router.route('/callback')
    .get(async (req, res) => {
        // your application requests refresh and access tokens
        // after checking the state parameter

        var code = req.query.code || null; // this is valid.
        var state = req.query.state || null; // this is valid.
        var storedState = req.cookies ? req.cookies[stateKey] : null;

        if (state === null || state !== storedState) {
            const params = new URLSearchParams({
                error: 'state_mismatch'
            }).toString();

            res.redirect('/#' + params);
        } else {
            res.clearCookie(stateKey);

            let finalRedirectUri = ""
            if (redirect_uri === 'http://localhost:') {
                finalRedirectUri = redirect_uri + res.serverPort + AUTH_CALLBACK;
            } else {
                finalRedirectUri = redirect_uri + AUTH_CALLBACK;
            }

            var authOptions = {
                url: 'https://accounts.spotify.com/api/token',
                form: {
                    code: code,
                    redirect_uri: finalRedirectUri,
                    grant_type: 'authorization_code'
                },
                headers: {
                    'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
                },
                json: true
            };
            request.post(authOptions, function(error, response, body) {
                if (!error && response.statusCode === 200) {

                    var access_token = body.access_token,
                        refresh_token = body.refresh_token;

                    console.log(" -- ACCESS TOKEN: -- \n")
                    console.log(access_token)
                    req.session.accessToken = access_token
                    // res.accessToken = access_token;

                    var options = {
                        url: 'https://api.spotify.com/v1/me',
                        headers: { 'Authorization': 'Bearer ' + access_token },
                        json: true
                    };

                    // use the access token to access the Spotify Web API
                    request.get(options, function(error, response, body) {
                        console.log(body);
                    });

                    const params = new URLSearchParams({
                        access_token: access_token,
                        refresh_token: refresh_token
                    }).toString();

                    // we can also pass the token to the browser to make requests from there
                    res.redirect('/#' + params);
                } else {
                    const params = new URLSearchParams({
                        error: 'invalid_token'
                    }).toString();

                    res.redirect('/#' + params);
                }
            });
        }
    })

module.exports = router;
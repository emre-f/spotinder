const express = require('express');
const router = express.Router();
const request = require('request');
const axios = require('axios');
const { Console } = require('console');

router.route('/')
    .get((req, res) => {
        let accessToken = req.session.accessToken
        let accessTokenPresent = accessToken !== undefined;

        console.log("The token: ", accessToken)
        res.render('playlistMatch', { accessToken, accessTokenPresent })
    })

router.route('/validate')
    .get(async (req, res) => {
        let playlistOneId = req.query.playlistOneId; // '5AjvX2GUVVcb7fGhny9HML' // Rap and the beat
        let playlistTwoId = req.query.playlistTwoId; // '6iU4NJJg0CwAVnnF3LgMjX' // Still M.R.E.
        let accessToken = req.query.accessToken;

        // Validate playlist one
        try {
            axiosResponse = await axios.get(`https://api.spotify.com/v1/playlists/${playlistOneId}`, { 
                headers: {
                    'Content-Type': 'application-json',
                    'Authorization': `Bearer ${accessToken}`
                }});
        } catch (e) {
            console.log("Caught an error for playlist 1")
            console.log(e.response.data.error)

            var playlistOneFailed = true;
        } finally {
            if (!playlistOneFailed) { 
                console.log("Playlist 1 is valid, name: ", axiosResponse.data.name) 
                var playlistOneData = axiosResponse.data;
            }
        }

        // Validate playlist two
        try {
            axiosResponse = await axios.get(`https://api.spotify.com/v1/playlists/${playlistTwoId}`, { 
                headers: {
                    'Content-Type': 'application-json',
                    'Authorization': `Bearer ${accessToken}`
                }});
        } catch (e) {
            console.log("Caught an error for playlist 2")
            console.log(e.response.data.error)

            var playlistTwoFailed = true;
        } finally {
            if (!playlistTwoFailed) { 
                console.log("Playlist 2 is valid, name: ", axiosResponse.data.name) 
                var playlistTwoData = axiosResponse.data;
            }
        }

        let accessTokenPresent = accessToken !== undefined;

        if(playlistOneFailed || playlistTwoFailed) {

            // Define error
            let error = ""
            if (playlistOneFailed && playlistTwoFailed) {
                error = "Both IDs entered were incorrect."
            } else if (playlistOneFailed) {
                error = "The ID entered for Playlist 1 was incorrect."
            } else if (playlistTwoFailed) {
                error = "The ID entered for Playlist 2 was incorrect."
            }

            res.render('playlistMatch', { accessToken, accessTokenPresent, error })
        }

        res.render('playlistMatchResults', { accessToken, accessTokenPresent, playlistOneData, playlistTwoData })
    })

module.exports = router;

// Old way to get axios get request
// axios({
//     method: 'get',
//     url: `https://api.spotify.com/v1/playlists/${playlistOneId}`,
//     headers: {
//         'Content-Type': 'application-json',
//         'Authorization': `Bearer ${accessToken}`
//     },
// })
// .then(function (axiosResponse) {
//     console.log("Playlist 1 is valid, name: ", axiosResponse.data.name)
// }).catch(function (e) {
//     console.log("Caught an error for playlist 1")
//     console.log(e.response.data.error)

//     playlistOneFailed = true;
//     return playlistOneFailed;
// });
const express = require('express');
const router = express.Router();
const request = require('request');
const axios = require('axios');

router.route('/')
    .get((req, res) => {
        let accessToken = req.session.accessToken
        let accessTokenPresent = accessToken !== undefined;
        console.log("The token: ", accessToken)
        res.render('playlistMatch', { accessToken, accessTokenPresent })
    })

router.route('/validate')
    .get(async (req, res) => {
        // let playlistId = '5AjvX2GUVVcb7fGhny9HML';
        // let accessToken = 'BQBEPIrl3IVhSDxrtvdT5PeKlxDhJHjPDT_2aFP076Do5IHm5Vv6J0zyJFxXtYd_ROB5VaC6cm1I4HtV5lQXQy4etmb4ikPdM-QIYzmltIHXxQi_pJtba1aDzG-aQkhe3KIlyVQUyVKvSjb-aAjGCovzLH_j_hI';
        let playlistId = req.query.playlistId;
        let accessToken = req.query.accessToken;
        console.log(req.query)

        axios({
            method: 'get',
            url: `https://api.spotify.com/v1/playlists/${playlistId}`,
            headers: {
                'Content-Type': 'application-json',
                'Authorization': `Bearer ${accessToken}`
            },
        }).then(function (axiosResponse) {
            // console.log(axiosResponse.data)
            res.send(axiosResponse.data)
        });

        
        // let accessToken = req.session.accessToken
        // let accessTokenPresent = accessToken !== undefined;
        // res.render('home', { accessToken, accessTokenPresent })
    })

module.exports = router;
const express = require('express');
const router = express.Router();
const request = require('request');

router.route('/')
    .get((req, res) => {
        let accessToken = req.session.accessToken
        let accessTokenPresent = accessToken !== undefined;
        console.log("The token: ", accessToken)
        res.render('playlistMatch', { accessTokenPresent })
    })

module.exports = router;
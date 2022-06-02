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

        resultPlaylistOne = await getTopGenres(accessToken, playlistOneData)
        resultPlaylistTwo = await getTopGenres(accessToken, playlistTwoData)

        console.log(playlistOneData)

        var [ playlistOneGenres, playlistTwoGenres ] = [ resultPlaylistOne.genresArray, resultPlaylistTwo.genresArray ]
        var [ playlistOneSongCount, playlistTwoSongCount ] = [ resultPlaylistOne.songCount, resultPlaylistTwo.songCount ]
        var [ playlistOneArtistCount, playlistTwoArtistCount ] = [ resultPlaylistOne.artistCount, resultPlaylistTwo.artistCount ]
        var [ playlistOneGenreCount, playlistTwoGenreCount ] = [ resultPlaylistOne.genreCount, resultPlaylistTwo.genreCount ]
        var [ playlistOneRecentTracks, playlistTwoRecentTracks ] = [ resultPlaylistOne.recentTracks, resultPlaylistTwo.recentTracks ]

        res.render('playlistMatchResults', { 
            accessToken, 
            accessTokenPresent, 
            playlistOneData, playlistTwoData,
            playlistOneGenres, playlistTwoGenres,
            playlistOneSongCount, playlistTwoSongCount,
            playlistOneArtistCount, playlistTwoArtistCount,
            playlistOneGenreCount, playlistTwoGenreCount,
            playlistOneRecentTracks, playlistTwoRecentTracks
        })
    })

module.exports = router;

// From the top 100 songs, get artists (with counts, to send less requests). Then get genres for all artists, multiply with count and return result.
async function getTopGenres (accessToken, playlistData) {
    console.log("getTopGenres() called");

    // Get all the songs (if tracks.length >100)
    var tracks = playlistData.tracks.items
    var nextLink = playlistData.tracks.next; // if not undefined, more songs

    while(nextLink !== undefined && nextLink !== null) {
        console.log("next link: ", nextLink)
        console.log("More songs, calling again...")
        // Get next 100 songs
        try {
            axiosResponse = await axios.get(nextLink, { 
                headers: {
                    'Content-Type': 'application-json',
                    'Authorization': `Bearer ${accessToken}`
                }});
        } catch (e) {
            console.log("Caught an error getting extra songs")
            console.log(e.response)
    
            var getNextSongsFailed = true;
        } finally {
            if (!getNextSongsFailed) { 
                tracks.push.apply(tracks, axiosResponse.data.items)
                nextLink = axiosResponse.data.next;
                // console.log("next link 2: ", nextLink)
            } else {
                nextLink = undefined;
            }
        }
    }

    console.log("Total song count: ", tracks.length);

    // Get the most recent 5 songs
    let recentTracks = []
    for (let i = 0; i < playlistData.tracks.items.length; i++) {
        let currTrack = playlistData.tracks.items[i];
        
        recentTracks.push([currTrack.added_at, currTrack.track])
        
        // console.log(currTrack.track.album.images[2])
        // recentTracks.push([currTrack.added_at, currTrack.track.artists[0].name, currTrack.track.name])
    }

    // Sort recent tracks
    recentTracks.sort(function(a,b){
        // Turn your strings into dates, and then subtract them
        // to get a value that is either negative, positive, or zero.
        return new Date(a.date) - new Date(b.date);
    });

    let tmp = []

    for (let i = 0; i < Math.min(5, recentTracks.length); i++) {
        tmp.push(recentTracks[recentTracks.length - 1 - i])
    }

    recentTracks = tmp

    // Get a dictionary of artists and their counts
    let artistIds = {};

    // ARTISTS AND COUNTS
    for (let i = 0; i < playlistData.tracks.items.length; i++) {
        // console.log(playlistData.tracks.items[i].track.artists[0].name)
        let artistId = playlistData.tracks.items[i].track.artists[0].id;

        artistIds[artistId] = (artistIds[artistId] || 0) + 1;
    }

    // create 1 string of all ids, separated by commas
    // MAXIMUM 50 IDS!
    // Have array with n slots, where each slot can take 50 ids.
    var ids = Array(Math.floor(Object.keys(artistIds).length / 50) + 1).fill(""); 

    for (let i = 0; i < Object.keys(artistIds).length; i++) {
        let artistId = Object.keys(artistIds)[i];
        
        // Which slot (move up once every 50 artists)
        let slot = Math.floor(i / 50);

        if (i % 50 === 0) { // Creating a new element, no ',' needed
            ids[slot] += artistId;
            continue
        }
        
        ids[slot] += "," + artistId
    }

    // GET ALL ARTISTS, GO THROUGH AND ADD THEIR GENRES (*for each ids element)
    var allArtists = []

    for (let i = 0; i < ids.length; i++) {
        try {
            axiosResponse = await axios.get(`https://api.spotify.com/v1/artists?ids=${ids[i]}`, { 
                headers: {
                    'Content-Type': 'application-json',
                    'Authorization': `Bearer ${accessToken}`
                }});
        } catch (e) {
            console.log("Caught an error getting all artists")
            console.log(e.response.data.error)
    
            var getAllArtistsFailed = true;
        } finally {
            if (!getAllArtistsFailed) { 
                allArtists.push.apply(allArtists, axiosResponse.data.artists)
            }
        }
    }

    let allGenres = {};
    let artistCount = [] // Each artist and their count

    for (let i = 0; i < allArtists.length; i++) {
        if (allArtists[i] === undefined || allArtists[i] === null) { continue }

        let multiplier = artistIds[allArtists[i].id]; // how many songs they had?

        artistCount.push([allArtists[i], multiplier])

        for (let j = 0; j < allArtists[i].genres.length; j++) {
            let genre = allArtists[i].genres[j];
            allGenres[genre] = (allGenres[genre] || 0) + (1 * multiplier);
        }
    }

    // Sort the genres and return the top ones
    let genresArray = []
    for (let i = 0; i < Object.keys(allGenres).length; i++) {
        genresArray.push([Object.keys(allGenres)[i], allGenres[Object.keys(allGenres)[i]]])
    }

    genresArray.sort(function(a, b) {
        return b[1] - a[1];
    });

    // Sort the artist count
    artistCount.sort(function(a, b) {
        return b[1] - a[1];
    });
    
    return { 
        genresArray,
        songCount: tracks.length,
        artistCount,
        genreCount: Object.keys(allGenres).length,
        recentTracks
    }
}

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
const express = require('express');
const router = express.Router();
const request = require('request');
const axios = require('axios');
const { Console } = require('console');
const { match } = require('assert');

router.route('/')
    .get((req, res) => {
        let accessToken = req.session.accessToken
        let accessTokenPresent = accessToken !== undefined;

        console.log("The token: ", accessToken)
        res.render('playlistMatch', { accessToken, accessTokenPresent })
    })

router.route('/validate')
    .get(async (req, res) => {
        let playlistOneLink = req.query.playlistOneId; 
        let playlistTwoLink = req.query.playlistTwoId; 

        var playlistOneOnlyIncludeOwnerSongs = req.query.playlistOneOnlyIncludeOwner === undefined ? false : req.query.playlistOneOnlyIncludeOwner;
        var playlistTwoOnlyIncludeOwnerSongs = req.query.playlistTwoOnlyIncludeOwner === undefined ? false : req.query.playlistTwoOnlyIncludeOwner;

        // Change the ids so that the ID is subtracted from the whole entry
        // There might not be a ? depending on how you get the link... so adjusting for it 

        var playlistOneId = playlistOneLink.substring(
            playlistOneLink.indexOf("/playlist/") + 10, 
            (playlistOneLink.indexOf("?") === -1) ? playlistOneLink.length :  playlistOneLink.indexOf("?")
        );

        var playlistTwoId = playlistTwoLink.substring(
            playlistTwoLink.indexOf("/playlist/") + 10, 
            (playlistTwoLink.indexOf("?") === -1) ? playlistTwoLink.length :  playlistTwoLink.indexOf("?")
        );

        console.log("Playlist One ID: " + playlistOneId) // '5AjvX2GUVVcb7fGhny9HML' // Rap and the beat
        console.log("Playlist Two ID: " + playlistTwoId) // '6iU4NJJg0CwAVnnF3LgMjX' // Still M.R.E.
   
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
            console.log(e);
            // console.log(e.response.data.error)

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

        // Used in other stages, it adds more to the .tracks array
        let allPlaylistOneSongs = await getAllSongs(accessToken, playlistOneData, playlistOneOnlyIncludeOwnerSongs);
        let allPlaylistTwoSongs = await getAllSongs(accessToken, playlistTwoData, playlistTwoOnlyIncludeOwnerSongs);

        resultPlaylistOne = await getSummaryInformation(accessToken, allPlaylistOneSongs)
        resultPlaylistTwo = await getSummaryInformation(accessToken, allPlaylistTwoSongs)

        var [ playlistOneGenres, playlistTwoGenres ] = [ resultPlaylistOne.genresArray, resultPlaylistTwo.genresArray ]
        var [ playlistOneSongCount, playlistTwoSongCount ] = [ resultPlaylistOne.songCount, resultPlaylistTwo.songCount ]
        var [ playlistOneArtistCount, playlistTwoArtistCount ] = [ resultPlaylistOne.artistCount, resultPlaylistTwo.artistCount ]
        var [ playlistOneGenreCount, playlistTwoGenreCount ] = [ resultPlaylistOne.genreCount, resultPlaylistTwo.genreCount ]
        var [ playlistOneRecentTracks, playlistTwoRecentTracks ] = [ resultPlaylistOne.recentTracks, resultPlaylistTwo.recentTracks ]

        // MATCHING INFO
        resultMatchingInfo = await getMatchingInformation(allPlaylistOneSongs, allPlaylistTwoSongs, resultPlaylistOne, resultPlaylistTwo)

        res.render('playlistMatchResults', { 
            accessToken, 
            accessTokenPresent, 
            playlistOneData, playlistTwoData,
            playlistOneGenres, playlistTwoGenres,
            playlistOneSongCount, playlistTwoSongCount,
            playlistOneArtistCount, playlistTwoArtistCount,
            playlistOneGenreCount, playlistTwoGenreCount,
            playlistOneRecentTracks, playlistTwoRecentTracks,
            matchingSongs: resultMatchingInfo.matchingSongs,
            matchingArtists: resultMatchingInfo.matchingArtists,
            matchingGenres: resultMatchingInfo.matchingGenres,

            playlistOneName: playlistOneData.name, playlistTwoName: playlistTwoData.name,
            playlistOneOwnerName: playlistOneData.owner.display_name, playlistTwoOwnerName: playlistTwoData.owner.display_name, 
            playlistOneFollowerCount: playlistOneData.followers.total, playlistTwoFollowerCount: playlistTwoData.followers.total,

            returnPoint: "/playlists"
        })
    })

module.exports = router;

async function getAllSongs (accessToken, playlistData, onlyOwnerSongs) {
    // Get all the songs (if tracks.length >100)
    var tracks = []

    for (let i = 0; i < playlistData.tracks.items.length; i++) {
        let track = playlistData.tracks.items[i];

        if (onlyOwnerSongs && track.added_by.id !== playlistData.owner.id) {
            continue;
        }

        tracks.push(track);
    }

    var nextLink = playlistData.tracks.next; // if not undefined, more songs

    while(nextLink !== undefined && nextLink !== null) {
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
                for (let i = 0; i < axiosResponse.data.items.length; i++) {
                    let track = axiosResponse.data.items[i];

                    if (onlyOwnerSongs && track.added_by.id !== playlistData.owner.id) {
                        continue;
                    }
            
                    tracks.push(track);
                }

                nextLink = axiosResponse.data.next;
                // console.log("next link 2: ", nextLink)
            } else {
                nextLink = undefined;
            }
        }
    }

    console.log("Total song count: ", tracks.length);
    return tracks;
}

async function getMatchingInformation (playlistOneSongs, playlistTwoSongs, playlistOneInfo, playlistTwoInfo) {
    // -- MATCHING SONGS

    // Get array of song IDs for the first playlist
    var playlistOneSongIds = [];
    for (let i = 0; i < playlistOneSongs.length; i++) {
        playlistOneSongIds.push(playlistOneSongs[i].track.id);
    }

    // Get songs with matching IDs from playlist two
    var matchingSongs = []
    for (let i = 0; i < playlistTwoSongs.length; i++) {
        let song = playlistTwoSongs[i];
        
        if(playlistOneSongIds.includes(song.track.id) && song.track.id !== null) {
            matchingSongs.push(song);
        }
    }

    // Randomize the list
    matchingSongs = shuffle(matchingSongs);

    // -- MATCHING ARTISTS

    // Give each artist a rank, based on how many times they appear
    var playlistOneArtists = giveRank(playlistOneInfo.artistCount);
    var playlistTwoArtists = giveRank(playlistTwoInfo.artistCount);

    // Get playlist 1 artist IDs
    var playlistOneArtistIds = [];
    for (let i = 0; i < playlistOneArtists.length; i++) {
        playlistOneArtistIds.push(playlistOneArtists[i][0].id);
    }

    var matchingArtists = []
    // Get playlist 2 artists that match, and also add their ranks in playlist 1 and 2
    for (let i = 0; i < playlistTwoArtists.length; i++) {
        let foundIndex = playlistOneArtistIds.indexOf(playlistTwoArtists[i][0].id);
        if(foundIndex !== -1) {
            matchingArtists.push({
                artist: playlistTwoArtists[i][0], 
                playlistOneRank: playlistOneArtists[foundIndex][2] , 
                playlistTwoRank: playlistTwoArtists[i][2]
            })
        }
    }

    // Sort based on total rank (smallest rank => higher up)
    matchingArtists.sort(function(a, b) {
        return (a.playlistOneRank + a.playlistTwoRank) - (b.playlistOneRank + b.playlistTwoRank);
    });

    // -- MATCHING GENRES

    // Give each genre a rank, based on how many times they appear;
    var playlistOneGenres = giveRank(playlistOneInfo.genresArray);
    var playlistTwoGenres = giveRank(playlistTwoInfo.genresArray);

    // Get playlist 1 genre names
    var playlistOneGenreNames = [];
    for (let i = 0; i < playlistOneGenres.length; i++) {
        playlistOneGenreNames.push(playlistOneGenres[i][0]);
    }

    // Get playlist 2 genres that match, and also add their ranks in playlist 1 and 2
    var matchingGenres = []

    for (let i = 0; i < playlistTwoGenres.length; i++) {
        let foundIndex = playlistOneGenreNames.indexOf(playlistTwoGenres[i][0]);

        if(foundIndex !== -1) {
            matchingGenres.push({
                genre: playlistTwoGenres[i][0], 
                playlistOneRank: playlistOneGenres[foundIndex][2] , 
                playlistTwoRank: playlistTwoGenres[i][2]
            })
        }
    }

    // Sort based on total rank (smallest rank => higher up)
    matchingGenres.sort(function(a, b) {
        return (a.playlistOneRank + a.playlistTwoRank) - (b.playlistOneRank + b.playlistTwoRank);
    });

    return { matchingSongs, matchingArtists, matchingGenres }
}

function shuffle(array) {
    let currentIndex = array.length,  randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }

    return array;
}

function giveRank(artistCount) {
    let playlistOneArtists = Array.from(artistCount);
    var rank = 1;
    var count = 0; // how many songs in that specific rank
    for (let i = 0; i < playlistOneArtists.length; i++) {
        if (i === 0) {
            playlistOneArtists[i].push(rank);
            continue;
        }

        if (playlistOneArtists[i - 1][1] === playlistOneArtists[i][1]) { // If artists have the same count... same rank
            playlistOneArtists[i].push(rank);
            count += 1;
        } else {
            rank += 1 + count;
            playlistOneArtists[i].push(rank);
            count = 0;
        }
    }

    return playlistOneArtists
}

// From the top 100 songs, get artists (with counts, to send less requests). Then get genres for all artists, multiply with count and return result.
async function getSummaryInformation (accessToken, playlistSongs) {
    console.log("getSummaryInformation() called");

    // Get the most recent 5 songs
    let recentTracks = []
    for (let i = 0; i < playlistSongs.length; i++) {
        let currTrack = playlistSongs[i];
        
        recentTracks.push([currTrack.added_at, currTrack.track])
        
        // console.log(currTrack.track.album.images[2])
        // recentTracks.push([currTrack.added_at, currTrack.track.artists[0].name, currTrack.track.name])
    }

    // Sort recent tracks
    recentTracks.sort(function(a,b){
        // Turn your strings into dates, and then subtract them
        // to get a value that is either negative, positive, or zero.
        return new Date(a[0]) - new Date(b[0]);
    });

    let tmp = []

    for (let i = 0; i < Math.min(5, recentTracks.length); i++) {
        tmp.push(recentTracks[recentTracks.length - 1 - i])
    }

    recentTracks = tmp

    // Get a dictionary of artists and their counts
    let artistIds = {};

    // ARTISTS AND COUNTS
    for (let i = 0; i < playlistSongs.length; i++) {
        let artistId = playlistSongs[i].track.artists[0].id;

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
        let capitalized = Object.keys(allGenres)[i].replace(/(^\w{1})|(\s+\w{1})/g, letter => letter.toUpperCase()); // capitalize first letters
        genresArray.push([capitalized, allGenres[Object.keys(allGenres)[i]]])
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
        songCount: playlistSongs.length,
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
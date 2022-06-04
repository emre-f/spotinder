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
        res.render('userMatch', { accessToken, accessTokenPresent })
    })

router.route('/validate')
    .get(async (req, res) => {
        let userOneLink = req.query.usernameOne; 
        let userTwoLink = req.query.usernameTwo; 

        var userOneOnlyIncludePersonalPlaylists = req.query.userOneOnlyIncludeUser === undefined ? false : req.query.userOneOnlyIncludeUser;
        var userTwoOnlyIncludePersonalPlaylists = req.query.userTwoOnlyIncludeUser === undefined ? false : req.query.userTwoOnlyIncludeUser;

        var userOneOnlyIncludeTheirSongs = req.query.userOneOnlyIncludeUserSongs === undefined ? false : req.query.userOneOnlyIncludeUserSongs;
        var userTwoOnlyIncludeTheirSongs = req.query.userTwoOnlyIncludeUserSongs === undefined ? false : req.query.userTwoOnlyIncludeUserSongs;

        // Change the ids so that the ID is subtracted from the whole entry
        // There might not be a ? depending on how you get the link... so adjusting for it 

        var userOneId = userOneLink.substring(
            userOneLink.indexOf("/user/") + 6, 
            (userOneLink.indexOf("?") === -1) ? userOneLink.length :  userOneLink.indexOf("?")
        );

        var userTwoId = userTwoLink.substring(
            userTwoLink.indexOf("/user/") + 6, 
            (userTwoLink.indexOf("?") === -1) ? userTwoLink.length :  userTwoLink.indexOf("?")
        );

        console.log("Playlist One ID: " + userOneId) // 'azaknami'
        console.log("Playlist Two ID: " + userTwoId)
        
        let accessToken = req.query.accessToken;

        // Validate user one
        try {
            axiosResponse = await axios.get(`https://api.spotify.com/v1/users/${userOneId}`, { 
                headers: {
                    'Content-Type': 'application-json',
                    'Authorization': `Bearer ${accessToken}`
                }});
        } catch (e) {
            console.log("Caught an error for user 1")
            console.log(e.response.data.error)

            var userOneFailed = true;
        } finally {
            if (!userOneFailed) { 
                console.log("User 1 is valid, name: ", axiosResponse.data.display_name) 
                var userOneData = axiosResponse.data;
            }
        }

        // Validate playlist two
        try {
            axiosResponse = await axios.get(`https://api.spotify.com/v1/users/${userTwoId}`, { 
                headers: {
                    'Content-Type': 'application-json',
                    'Authorization': `Bearer ${accessToken}`
                }});
        } catch (e) {
            console.log("Caught an error for user 2")
            console.log(e.response.data.error)

            var userTwoFailed = true;
        } finally {
            if (!userTwoFailed) { 
                console.log("User 2 is valid, name: ", axiosResponse.display_name) 
                var userTwoData = axiosResponse.data;
            }
        }

        let accessTokenPresent = accessToken !== undefined;

        if(userOneFailed || userTwoFailed) {

            // Define error
            let error = ""
            if (userOneFailed && userTwoFailed) {
                error = "Both IDs entered were incorrect."
            } else if (userOneFailed) {
                error = "The ID entered for User 1 was incorrect."
            } else if (userTwoFailed) {
                error = "The ID entered for User 2 was incorrect."
            }

            res.render('userMatch', { accessToken, accessTokenPresent, error })
        }

        // Used in other stages, it adds more to the .tracks array
        let allUserOneSongs = await getAllSongs(accessToken, userOneId, userOneOnlyIncludePersonalPlaylists, userOneOnlyIncludeTheirSongs);
        let allUserTwoSongs = await getAllSongs(accessToken, userTwoId, userTwoOnlyIncludePersonalPlaylists, userTwoOnlyIncludeTheirSongs);

        let userOneSummary = await getSummaryInformation(accessToken, allUserOneSongs)
        let userTwoSummary = await getSummaryInformation(accessToken, allUserTwoSongs)

        var [ playlistOneGenres, playlistTwoGenres ] = [ userOneSummary.genresArray, userTwoSummary.genresArray ]
        var [ playlistOneSongCount, playlistTwoSongCount ] = [ userOneSummary.songCount, userTwoSummary.songCount ]
        var [ playlistOneArtistCount, playlistTwoArtistCount ] = [ userOneSummary.artistCount, userTwoSummary.artistCount ]
        var [ playlistOneGenreCount, playlistTwoGenreCount ] = [ userOneSummary.genreCount, userTwoSummary.genreCount ]
        var [ playlistOneRecentTracks, playlistTwoRecentTracks ] = [ userOneSummary.recentTracks, userTwoSummary.recentTracks ]

        // MATCHING INFO
        resultMatchingInfo = await getMatchingInformation(allUserOneSongs, allUserTwoSongs, userOneSummary, userTwoSummary)

        res.render('playlistMatchResults', { 
            accessToken, 
            accessTokenPresent, 
            playlistOneData: userOneData, 
            playlistTwoData: userTwoData,
            playlistOneGenres, playlistTwoGenres,
            playlistOneSongCount, playlistTwoSongCount,
            playlistOneArtistCount, playlistTwoArtistCount,
            playlistOneGenreCount, playlistTwoGenreCount,
            playlistOneRecentTracks, playlistTwoRecentTracks,
            matchingSongs: resultMatchingInfo.matchingSongs,
            matchingArtists: resultMatchingInfo.matchingArtists,
            matchingGenres: resultMatchingInfo.matchingGenres,

            playlistOneName: userOneId, playlistTwoName: userTwoId,
            playlistOneOwnerName: userOneData.display_name, playlistTwoOwnerName: userTwoData.display_name, 
            playlistOneFollowerCount: userOneData.followers.total, playlistTwoFollowerCount: userTwoData.followers.total,

            returnPoint: "/users"
        })
    })

module.exports = router;

async function getAllSongs (accessToken, userId, onlyPersonal = false, onlyUserAddedSongs) {
    var allTracks = [];

    try {
        axiosResponse = await axios.get(`https://api.spotify.com/v1/users/${userId}/playlists`, { 
            headers: {
                'Content-Type': 'application-json',
                'Authorization': `Bearer ${accessToken}`
            }});
    } catch (e) {
        console.log(`Caught an error for ${userId}, while getting playlists.`)
        console.log(e.response.data.error)

        var userFailed = true;
    } finally {
        if (!userFailed) { 
            console.log(`The user ${userId} has ${axiosResponse.data.items.length} playlists.`);
            var allPlaylistObjects = axiosResponse.data.items;
        }
    }

    // For each ID, get all songs and add them to the tracks.
    for (let i = 0; i < allPlaylistObjects.length; i++) {
        let playlistId = allPlaylistObjects[i].id;

        // Request all playlist data
        try {
            axiosResponse = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, { 
                headers: {
                    'Content-Type': 'application-json',
                    'Authorization': `Bearer ${accessToken}`
                }});
        } catch (e) {
            console.log(`Caught an error for playlist with id ${playlistId}`)
            console.log(e.response.data.error)

            var playlistFailed = true;
        } finally {
            if (!playlistFailed) { 
                console.log(`Playlist with id ${playlistId} is valid, name: `, axiosResponse.data.name) 
                // console.log("Created by ", axiosResponse.data.owner.id)
                var playlistData = axiosResponse.data;
            }
        }

        if(onlyPersonal && playlistData.owner.id !== userId) { 
            console.log("Playlist created by someone else, skipping")
            continue; 
        }

        await delay(100);

        let playlistSongs = await getAllPlaylistSongs(accessToken, playlistData, userId , onlyUserAddedSongs);
        allTracks.push.apply(allTracks, playlistSongs)
    }

    console.log("TOTAL SONG LENGTH: ", allTracks.length);
    allTracks = await withoutDuplicateIds(allTracks);
    console.log("Filtering duplicates")
    console.log("TOTAL SONG LENGTH: ", allTracks.length);

    return allTracks;
}

// Filter out duplicates via track id
async function withoutDuplicateIds(objects) {
    const ids = [];
    return objects.filter(obj => {
        if(obj === null || obj.track === null) return false;

        if (obj.track.id === null || ids.includes(obj.track.id)) return false
        ids.push(obj.track.id);
        return true
    });
}

const delay = ms => new Promise(res => setTimeout(res, ms));

async function getAllPlaylistSongs (accessToken, playlistData, userId, onlyOwnerSongs) {
    // Get all the songs (if tracks.length >100)
    var tracks = []

    for (let i = 0; i < playlistData.tracks.items.length; i++) {
        let track = playlistData.tracks.items[i];

        if (onlyOwnerSongs && track.added_by.id !== userId) {
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
    
                    if (onlyOwnerSongs && track.added_by.id !== userId) {
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

    console.log("Total song count in the playlist: ", tracks.length);
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
async function getSummaryInformation (accessToken, allSongs) {
    console.log("getSummaryInformation() called");

    // Get the most recent 5 songs
    let recentTracks = []
    for (let i = 0; i < allSongs.length; i++) {
        let currTrack = allSongs[i];

        recentTracks.push([currTrack.added_at, currTrack.track])
    }

    // Sort recent tracks
    recentTracks.sort(function(a,b){
        // Turn your strings into dates, and then subtract them
        // to get a value that is either negative, positive, or zero.
        return new Date(a[0]) - new Date(b[0]);
    });

    let tmp = []

    for (let i = 0; i < Math.min(5, recentTracks.length); i++) {
        // console.log(recentTracks[recentTracks.length - 1 - i]);

        tmp.push(recentTracks[recentTracks.length - 1 - i])
    }

    recentTracks = tmp

    // Get a dictionary of artists and their counts
    let artistIds = {};

    // ARTISTS AND COUNTS
    for (let i = 0; i < allSongs.length; i++) {
        let artistId = allSongs[i].track.artists[0].id;

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
        songCount: allSongs.length,
        artistCount,
        genreCount: Object.keys(allGenres).length,
        recentTracks
    }
}
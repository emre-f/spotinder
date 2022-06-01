const express = require('express');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');
const cors = require('cors');
const path = require('path');
const ejsMate = require('ejs-mate');
const session = require('express-session');
require('dotenv').config();

const authenticateRoute = require('./routes/authenticate');
const playlistMatchRoute = require('./routes/playlistMatch')
const { access } = require('fs');

const app = express();

//

app.engine('ejs', ejsMate)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.use(express.static(path.join(__dirname, 'public')))
app.use(cors())
app.use(flash())
app.use(cookieParser())
app.use(session({secret: 'nuc0Nd7G3LNxBt7XMuha', resave: false, saveUninitialized: false}));

//

app.use((req, res, next) => {
    res.serverPort = server.address().port;
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
})

//

app.get('/', (req, res) => {
    let accessToken = req.session.accessToken;
    let accessTokenPresent = accessToken !== undefined;
    console.log("The token: ", accessToken)
    res.render('home', { accessTokenPresent })
});

app.use('/auth', authenticateRoute);
app.use('/playlists', playlistMatchRoute);

app.get('/logout', (req, res) => {
    res.locals.currentUser = null;

    if (typeof req.session.accessToken !== 'undefined') {
        req.session.accessToken = undefined;
    }

    res.redirect('/')
})

app.get('/callback', (req, res) => {
    res.return('The wrong callback!')
})

// app.all('*', (req, res, next) => {
//     next(new ExpressError('Page Not Found', 404))
// })

//

const port = process.env.PORT || 8888;
var server = app.listen(port, () => {
    console.log(`Serving on port ${port}`)
})
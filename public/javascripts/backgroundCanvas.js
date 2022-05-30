var canvas = document.getElementById("backgroundCanvas"),
    ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

function getStarCount() {
    let maxScreenArea = 1920 * 937;
    return Math.round(250 * ((canvas.width * canvas.height) / maxScreenArea));
};

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }  

var stars = [], // Array that contains the stars
    FPS = 60, // Frames per second
    x = getStarCount(), // Number of stars (for full size screen (1920, 937) 250 stars is nice, we should scale this)
    mouse = {
      x: 0,
      y: 0
    };  // mouse location

// Push stars to array

for (var i = 0; i < x; i++) {
  stars.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    radius: Math.random() * 1 + 1,
    vx: Math.floor(Math.random() * 30) - 25,
    vy: Math.floor(Math.random() * 30) - 25,
    opacity: 1 // the color opacity
  });
}

// Draw the scene

function draw() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  ctx.clearRect(0,0,canvas.width,canvas.height);
  
  ctx.globalCompositeOperation = "lighter";
  
  for (var i = 0, x = stars.length; i < x; i++) {
    var s = stars[i];
    
    // ctx.fillStyle = `rgba(29, 185, 84, ${s.opacity})`; // Hex color code: #1DB954
    let {r, g, b} = hexToRgb(dotColor);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${s.opacity})`; // Hex color code: #1DB954
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.stroke();
  }
  
  ctx.beginPath();
  for (var i = 0, x = stars.length; i < x; i++) {
    var starI = stars[i];
    ctx.moveTo(starI.x,starI.y); 
    if(distance(mouse, starI) < 100) ctx.lineTo(mouse.x, mouse.y);
    for (var j = 0, x = stars.length; j < x; j++) {
      var starII = stars[j];
      if(distance(starI, starII) < 100) {
        //ctx.globalAlpha = (1 / 150 * distance(starI, starII).toFixed(1));
        ctx.lineTo(starII.x,starII.y); 
      }
    }
  }
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = dotColor;
  ctx.stroke();
}

function distance( point1, point2 ){
  var xs = 0;
  var ys = 0;
 
  xs = point2.x - point1.x;
  xs = xs * xs;
 
  ys = point2.y - point1.y;
  ys = ys * ys;
 
  return Math.sqrt( xs + ys );
}

// Update star locations

// Create new stars once a second
let timer = 0.5; // 60 is about 25 seconds (?)
let totTimer = timer;
let starCount = 5; // Move n stars to a random pos

// Star fade out animation
let chooseStars = true;
let chosenStars = [];
let newStars = [];

let starFadeTimer = 3;
let totStarFadeTimer = starFadeTimer;

function moveStar( star ) {

    // Over 1 second, fade out old star and bright out new star
    star.x = Math.random() * canvas.width
    star.y = Math.random() * canvas.height
}

function update() {
    // console.log("STAR COUNT: " + stars.length);
    timer -= 1 / FPS;
    if (timer < 0) {
        starFadeTimer -= 1 / FPS;
        
        // Do this once: select old stars and create new ones
        // If we need more stars -> only add new ones
        // If we have too many -> only destroy them
        if (chooseStars) {

            if (stars.length > getStarCount()) { // We have too many stars
                // Select old stars
                for (var i = 0; i < starCount; i++) {
                    chosenStars.push(stars[i]);
                }
            }
            else { // We have too few
                // Create new stars
                for (var i = 0; i < starCount; i++) {
                    let newStar = {
                        x: Math.random() * canvas.width,
                        y: Math.random() * canvas.height,
                        radius: Math.random() * 1 + 1,
                        vx: Math.floor(Math.random() * 30) - 25,
                        vy: Math.floor(Math.random() * 30) - 25,
                        opacity: 0 // start at 0, will slowly appear
                    }
                    
                    stars.push(newStar)
                    newStars.push(newStar);
                }
            }

            chooseStars = false;
        }

        // Start fading out the old stars
        for (var i = 0; i < chosenStars.length; i++) {
            chosenStars[i].opacity = 1 * (starFadeTimer / totStarFadeTimer);
        }

        // Start fading in new stars
        for (var i = 0; i < newStars.length; i++) {
            newStars[i].opacity = 1 - 1 * (starFadeTimer / totStarFadeTimer);
        }

        if (starFadeTimer < 0) { 
            // Remove the old stars now
            stars = stars.filter(item => !chosenStars.includes(item))

            timer = totTimer;
            starFadeTimer = totStarFadeTimer;

            chooseStars = true;
            chosenStars = []; // clear out the past chosen stars
            newStars = [];
        }
    }

    // width and height updates properly here
    for (var i = 0, x = stars.length; i < x; i++) {
        var s = stars[i];

        s.x += s.vx / FPS;
        s.y += s.vy / FPS;

        // Update speeds depending on screen size: 
        
        if (s.x < 0 || s.x > canvas.width) s.vx = -s.vx;
        if (s.y < 0 || s.y > canvas.height) s.vy = -s.vy;
    }
}

onmousemove = function(e) {
    mouse.x = e.clientX
    mouse.y = e.clientY;
};

// canvas.addEventListener('mousemove', function(e){
//     console.log("hi?")
//   mouse.x = e.clientX;
//   mouse.y = e.clientY;
// });

// Update and draw

function tick() {
  draw();
  update();
  requestAnimationFrame(tick);
//   document.body.style.background = "url(" + canvas.toDataURL() + ")";
}

tick();
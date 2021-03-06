const get = require('lodash/get');
const pick = require('lodash/pick');
const session = require('cookie-session');
const passport = require('passport-restify');
const LocalStrategy = require('passport-local').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const uuid = require('uuid');

const CookieParser = require('restify-cookies');

const queries = require('./queries');
const conf = require('../../conf.json');
const fs = require('fs');

function hashPass(p) {
    return p;
}

function validateUserPwd(user, pp) {
    return user && hashPass(pp) === get(user,'_doc.password');
}
passport.use(new LocalStrategy(
    function(username, password, done) {
        queries.findUser({username}).then(found=>{        
            if (!validateUserPwd(found, password)) {
                return done(null, false); 
            }
            return done(null, found);
        }).catch(err=> {
            console.log('auth error');
            console.log(err);
            return next(err); 
        })      
    }
  ));

passport.serializeUser(function(user, done) {
    done(null, user);
  });
  
  passport.deserializeUser(function(user, done) {
    const cond = [];
    if (user.uuid) {
        cond.push({uuid:user.uuid});
    }
    if (user.email) {
        cond.push({email:user.email});
    }
    queries.findUser({$or:cond}).then(found=>{                
        return done(null, found);         
    }).catch(err=> {
        console.log('auth error');
        console.log(err);
        return done(err); 
    })  
    //User.findById(id, function (err, user) {
    //  done(err, user);
    //});
  });

function oldAuth(server) {
server.use((req, res, next)=>{
    queries.findUser({username: req.username}).then(found=>{        
        if (!validateUserPwd(found, req.authorization.basic.password)) {
            res.send(401, 'Unauthorized');
            return next(false);
        }
        return next();
    }).catch(err=> {
        console.log('auth error');
        console.log(err);
        return next(err); 
    })
}); 
}

function initPassport(server) {
      
    server.use(CookieParser.parse);
    server.use(session({
        keys: conf.sessionKeys || ['key1xxxx', 'key2xxxxx'],
        name: 'egteam:sess',
	    maxage: 48 * 3600 /*hours*/ * 1000,  /*in milliseconds*/
	    secureProxy: false // if you do SSL outside of node
    }));
    
    server.use(passport.initialize());
    server.use(passport.session());

    const loginRedirectRoot = '/';
    const loginRedFunc = (req, res)=>{
        res.redirect(loginRedirectRoot, ()=>{});
    };
    server.post('/login', 
        passport.authenticate('local', { failureRedirect: '/login' }),
        loginRedFunc);


    passport.use(new FacebookStrategy(Object.assign({},conf.facebook,{profileFields: ['id', 'emails', 'name']}),
        function(accessToken, refreshToken, profile, cb) {
            const email = get(profile,'emails[0].value');
            const userData = {
                idOnProvider: profile.id,
                last_name: get(profile,'name.familyName'),
                first_name: get(profile,'name.givenName'),
                email,
                username: email,
                provider: profile.provider,
                uuid: uuid.v1(),
            };
            console.log(`facebook login ${userData.email}`);
            return queries.findUser({email: userData.email}).then(found=>{                        
                if (found) {
                    return cb(null, found);
                }else {
                    return queries.cmdInsert("Users", userData).then(()=>{
                        cb(null, userData);
                    });
                }
            }).catch(err=> {
                console.log('facebook auth error');
                console.log(err);
                return cb(err); 
            })           
        }
    ));

    server.use((req, res, next)=>{
        console.log(req.url);     
        const username = get(req,'username');
        const password = get(req,'authorization.basic.password');   
        if (username && password) {
            queries.findUser({username}).then(found=>{
                if (validateUserPwd(found,password)) {
                    req.user = found;
                }
                return next();   
            });
        }else
            return next();        
    }); 
    server.get('/auth/facebook', passport.authenticate('facebook'));
      
    server.get('/auth/facebook/callback',
        passport.authenticate('facebook', { failureRedirect: '/login' }),
        (req, res)=>{
            try {
                res.end(fs.readFileSync("./build/index.html"));
            } catch (err) {
                res.redirect(conf.ui.root, ()=>{});
            }
            //res.end(JSON.stringify({
            //  user: pick(req.user,['email','id']),  
            //  cookie: req.cookies[`${req.sessionKey}`],
            //  cookieKey: req.cookies[`${req.sessionKey}.sig`],
            //}));
        });
    
}

module.exports = {
    initPassport,
};
node-nicovideo
==============
nicovideo API wrapper for node.js


## Current supported API
- Niconico Common API
    - Auth (one session managed by one Nico class instance.)
        - Login, Logout, Login Test

- Niconico Live API
    - Live information (aka GetPlayerStatus API)
    - Put & receive comments
    - Nsen API Wrapper

- Nicovideo API
    - Video information (aka GetThumbInfo API)

- Nicovideo MyList API
    -  MyList control (list, add) wrapped by Backbone.Collection

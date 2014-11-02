###
# このモジュールでは以下のイベントが発生します。
#   "login"  : ニコニコ動画へログインした時に発生します。
#   "logout" : ニコニコ動画からログアウトした時に発生します。
###

NicoSession  = require "./api/NicoSession"
NicoLive        = require "./api/live/NicoLiveApi"
NicoMyList      = require "./api/mylist/NicoMyListApi"
NicoVideo       = require "./api/video/NicoVideoApi"


class Nico
    @Session    = NicoSession
    @Live       = NicoLive
    @MyList     = NicoMyList
    @Video      = NicoVideo

    _session     : null

    # _live        : null # Lazy initialize
    # _video       : null # Lazy initialize
    # _mylist      : null # Lazy initialize

    constructor     : (user, password) ->
        @_session = new NicoSession user, password

        Object.defineProperties @,
            session :
                get     : -> @_session
                set     : ->
            live    :
                get     : -> @_live ?= new NicoLive @_session
                set     : ->
            video   :
                get     : -> @_video ?= new NicoVideo @_session
                set     : ->
            mylist  :
                get     : -> @_mylist ?= new NicoMyList @_session
                set     : ->


    loginThen : (resolved, rejected) ->
        @_session.loginThen resolved, rejected


module.exports = Nico

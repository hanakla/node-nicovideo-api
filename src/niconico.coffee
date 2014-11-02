###
# このモジュールでは以下のイベントが発生します。
#   "login"  : ニコニコ動画へログインした時に発生します。
#   "logout" : ニコニコ動画からログアウトした時に発生します。
###

NicoAuthTicket  = require "./api/NicoAuthTicket"
NicoLive        = require "./api/live/NicoLiveApi"
NicoMyList      = require "./api/mylist/NicoMyListApi"
NicoVideo       = require "./api/video/NicoVideoApi"


class Nico
    @Session    = NicoAuthTicket
    @Live       = NicoLive
    @MyList     = NicoMyList
    @Video      = NicoVideo

    _ticket     : null

    # _live        : null # Lazy initialize
    # _video       : null # Lazy initialize
    # _mylist      : null # Lazy initialize

    constructor     : (user, password) ->
        @_ticket = new NicoAuthTicket user, password

        Object.defineProperties @,
            live    :
                get     : -> @_live ?= new NicoLive @_ticket
                set     : ->
            video   :
                get     : -> @_video ?= new NicoVideo @_ticket
                set     : ->
            mylist  :
                get     : -> @_mylist ?= new NicoMyList @_ticket
                set     : ->

    loginThen : (resolved, rejected) ->
        @_ticket.loginThen resolved, rejected


module.exports = Nico

###
Object.defineProperties module.exports,
    Auth:
        get: -> return NicoAuthApi
    Live:
        get: -> return NicoLiveApi
    Video:
        get: -> return NicoVideoApi
    MyList:
        get: -> return NicoMyListApi
###

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
    _ticket     : null

    live        : null
    mylist      : null
    video       : null

    constructor     : (user, password) ->
        @_ticket = new NicoAuthTicket user, password

        @live   = new NicoLive @_ticket
        @mylist = new NicoMyList @_ticket
        @video  = new NicoVideo @_ticket


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

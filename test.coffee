path = require "path"

require("./src/niconico")
.login process.env.NICO_USER_ID, process.env.NICO_USER_PASS
.then (session) ->
    console.log "\u001b[32mLogin successed.\u001b[m"

    # session.live.getLiveInfo("nsen/toho")
    session.live.getNsenChannelHandlerFor("nsen/toho")

# .then (live) ->
#     live.commentProvider()
#     # console.log live
#     # console.log live.get()
# .then (provider) ->
#     provider.onDidReceiveData (xml) ->
#         console.log "\u001b[36m#{xml}\u001b[m"
#
#     provider.onDidReceiveComment (comment) ->
#         console.log "\u001b[36m[#{comment.get("user.id")} on #{comment.get("threadId")}] #{comment.comment}\u001b[m"
#
#     provider.connect()
# #
# .then (provider) ->
#     console.log "Connect to comment server successful "
#
#     # provider.postComment("おかー")


.then (nsenCh) ->
    nsenCh.onDidReceiveComment (comment) ->
        console.log "\u001b[36m[#{comment.get("user.id")} on #{comment.get("threadId")}] #{comment.comment}\u001b[m"

    # nsenCh.getLiveInfo().commentProvider().then (pv) ->
    #     pv.onDidReceiveComment (comment) ->
    #         console.log "\u001b[32m[#{comment.get("user.id")} on #{comment.get("threadId")}] #{comment.comment}\u001b[m"

    nsenCh.onWillClose =>
        console.log "\u001b[32mChannel will be closing."

        setTimeout ->
            console.log "Moving..."
            nsenCh.moveToNextLive().then ->
                console.log "Live info reatached"
        , 1000

    nsenCh.commentProvider()?._pourXMLData('<chat thread="1469773867" vpos="8712800" date="1443898928" date_usec="454327" mail="184" user_id="eOFiZKUhxv4A7TEXQs2Xd4jsdro" premium="6" anonymity="1">/reset lv237242878</chat>')

    # console.log "\u001b[36mConnected.\u001b[m"

# <chat thread="1469773867" vpos="8712800" date="1443898928" date_usec="454327" mail="184" user_id="eOFiZKUhxv4A7TEXQs2Xd4jsdro" premium="6" anonymity="1">/reset lv237242878</chat>

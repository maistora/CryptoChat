var serviceURL = "http://mobilecryptochat.apphb.com/MobileCryptoChatService.svc";
var sessionID;
var userLoginData;
var secretKey;
var randNumber;
var recepientMsisdn;
var invitation = null;
var __timer;
var time = 500;
var error_msg_count = 0;


// set listeners
$(document).ready(function() {
    
    $('#registerButton').click(function() {
        document.location.replace('#register');
    });    
    
    $('#loginButton').click(function() {
        prepareLoginData();
    });
    
    $('#regButton').click(function() {
        prepareRegistrationObject();
    });

    $('#logoutButton').click(function() {
        logout();
    });
    
    $('.onlineLink').click(function() {
        getUsers();
        window.location.replace("index.html#online");   
    });   
    $('.settingsLink').click(function() {
        prepareSettings();
        window.location.replace("index.html#settings");   
    });   
    
    $('#startChat').click(function() {
        sendInvitation();
    });
    
    $('#declineChatPopup').click(function() {
        // TODO optimization
        $('.popups').empty();
        invitation = null;
        window.location.replace('index.html#home');
    });
    
    $('#startChatPopup').click(function() {
        accept();
    });
    
    $('#cancelChatPopup').click(function() {
        chatCancel();    
    });
    
    $('#sendMessage').click(function() {
        sendIM();    
    });
    
    $('#setTimeFromSlider').click(function() {
        setRefreshRate();    
    });
    
    // for slider
    $(document).bind("pagecreate", function(event, ui) {
    
        $('#slider').siblings('.ui-slider')
            .bind('tap', function(event, ui) {
                    makeAjaxChange($(this).siblings('input'));
                });
        $('#slider').siblings('.ui-slider a')
            .bind('taphold', function(event, ui) {
                    makeAjaxChange($(this).parent()
                        .siblings('input'));
                });
    });
});


// receive messages from server
function getMsgsFromServer() {
    // not like in the documentation
    $.ajax({
        url : serviceURL + '/get-next-message/' + sessionID,
        type : 'GET',
        timeout : 5000,
        success : gotMessage,
        error : gettingMessageFail
    });
}   

// listening
function gotMessage(response) {
    console.log('zzzzzzzzzzzzzzz');
    if (response['msgType'] == 'MSG_NO_MESSAGES') {
        // do nothing
    }
    else if (response['msgType'] == 'MSG_USER_ONLINE' || 
            response['msgType'] =='MSG_USER_OFFLINE') {
        getUsers();
    }
    else if (response['msgType'] == 'MSG_CHALLENGE') {
        popUpRequestDialog(response['msisdn']);
        invitation = response;
    }
    else if (response['msgType'] == 'MSG_RESPONSE') {
        popUpMessage('Invitation accepted');
        startSession(response);
    }
    else if (response['msgType'] == 'MSG_START_CHAT') {
        window.location.replace('index.html#chatScreen');
    }
    else if (response['msgType'] == 'MSG_CANCEL_CHAT') {
        chatCancel();
    }
    else if (response['msgType'] == 'MSG_CHAT_MESSAGE') {
        incommingIM(response);
    }
}

function gettingMessageFail(err) {
    error_msg_count++;
    if (error_msg_count >= 10 ) {
        error_msg_count = 0;
        logout();
    }
}
// end receive messages from server


// cookies
function createCookie(name, value, days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        var expires = ";expires="+date.toGMTString();
    }
    else var expires = "";
    document.cookie = name + "=" + value + expires + ";path=/";
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name,"",-1);
}
// end cookies

    
// invitation
function sendInvitation() {

    var msisdn = $('#newMsisdnFromProfile').val();
    var key = $('#secretKey').val();
    if (isEmpty(msisdn)) {
        popUpMessage('Missing MSISDN');
        return;
    }
    if (isEmpty(key)) {
        popUpMessage('Missing Secret Key');
        return;
    }    
    
    var rand = Math.floor(Math.random()*1000000000);
    var challenge = GibberishAES.enc(rand, key); /* AES from gibberish-aes.js */
    
    var invitation = {
        "sessionID" : sessionID,
        "recipientMSISDN" : msisdn,
        "challenge" : challenge
    };
    
    recepientMsisdn = msisdn;
    secretKey = key;
    randNumber = rand;
    
    $.ajax({
        url : serviceURL + '/invite-user',
        type : 'POST',
        timeout : 5000,
        contentType : 'application/json',
        dataType : 'json',
        data : JSON.stringify(invitation),
        success: invitationSuccess,
        error: invitationFail
    });
    console.log('Invitation: ' + JSON.stringify(invitation));
}
 
function  invitationSuccess(response) {
    popUpMessage('Invitation sent');
}
function  invitationFail(err) {
    if (isEmpty(err['errorMsg'])) {
        popUpMessage('Invitation failed');
        return;
    }
    popUpMessage('Invitation failed');
}
// end invitation


// accept invitation
function accept() {
    if (invitation == null || isEmpty(invitation)) {
        popUpMessage('Cannot accept invitation')
        return;
    }
    try {
        acceptInvitation(invitation['msgText'], invitation['msisdn']);
    } catch (e) {
        popUpMessage('Wrong data');
    }
    $('.popups').empty();
    window.location.replace('index.html#home');
}

function acceptInvitation(encryptedInvitation, msisdnTo) {
    var key = $('#secretKeyInPopup').val();
    if (isEmpty(key) || isEmpty(encryptedInvitation) || isEmpty(msisdnTo)) {
        popUpMessage('Cannot accept invitation')
        return;
    }
    secretKey = key;
    recepientMsisdn = msisdnTo;
    var randNum = GibberishAES.dec(encryptedInvitation, key);
    var response = GibberishAES.enc(999999999 - randNum, key);
    
    var responseToInvitation = {
        'sessionID' : sessionID,
        'recipientMSISDN' : msisdnTo,
        'response' : response
    };
    
    $.ajax({
        url : serviceURL + '/response-chat-invitation',
        type : 'POST',
        timeout : 5000,
        contentType : 'application/json',
        dataType : 'json',
        data : JSON.stringify(responseToInvitation),
        success : acceptionSuccess,
        error : acceptionFail
    });
}

function acceptionSuccess(response) {
    popUpMessage('Invitation accepted');
}

function acceptionFail(err) {
    if (isEmpty(err['errorMsg'])) {
        popUpMessage('Accepting invitation failed');
        return;
    }
    popUpMessage(err['errorMsg']);
}
// end accept invitation


// start chat session
function startSession(response) {
    
    var decodedRandResponse = GibberishAES.dec(response["msgText"], secretKey);
    if (decodedRandResponse != 999999999 - randNumber) {
        chatCancel();
        popUpMessage('Chat canceled due to invalid data');
        return;
    }
    
    var chatData = {
        'sessionID' : sessionID,
        'recipientMSISDN' : response['msisdn']
    };

    $.ajax({
        url : serviceURL + '/start-chat',
        type : 'POST',
        timeout : 5000,
        contentType : 'application/json',
        dataType : 'json',
        data : JSON.stringify(chatData),
        success : chatSuccess,
        error : chatError
    });
}

function chatSuccess(successData) {
    popUpMessage('Chat started');
    window.location.replace('index.html#chatScreen');
}

function chatError(errs) {
    if (isEmpty(err['errorMsg'])) {
        popUpMessage('Error accured in chat.');
        return;
    }
    popUpMessage(err['errorMsg']);
}
// end start chat session


// chat cancel
function chatCancel() {
    var cancelData = {
        "sessionID" : sessionID,
        "recipientMSISDN" : recepientMsisdn
    };

    $('#chatWindow').empty();
    
    $.ajax({
        url : serviceURL + '/cancel-chat',
        type : 'POST',
        timeout : 5000,
        contentType : 'application/json',
        dataType : 'json',
        data : JSON.stringify(cancelData),
        success : cancelSuccess,
        error : cancelFail
    });
}

function cancelSuccess(response) {
    recepientMsisdn = '';
    popUpMessage('Chat quit by user');
    window.location.replace('index.html#home');
}

function cancelFail(err) {
    recepientMsisdn = '';
    if (isEmpty(err['errorMsg'])) {
        popUpMessage('Chat canceled unsafe');
    } else { 
        popUpMessage(err['errorMsg']);   
    }
    window.location.replace('index.html#home');
}
// end chat cancel


// send message
function sendMessage(message) {
    var encMsg = GibberishAES.enc(message, secretKey);
    
    var msgQuery = {
        'sessionID': sessionID,
        'recipientMSISDN': recepientMsisdn,
        'encryptedMsg': encMsg
    };

    $.ajax({
        url : serviceURL + '/send-chat-message',
        type : 'POST',
        timeout : 5000,
        contentType : 'application/json',
        dataType : 'json',
        data : JSON.stringify(msgQuery),
        success : sendMsgSuccess,
        error : sendMsgFail
    });
}

function sendMsgSuccess(response) {
    
}

function sendMsgFail(err) {
    if (isEmpty(err['errorMsg'])) {
        popUpMessage('Message not sent');
        return;
    }
    popUpMessage(err['errorMsg']);
}
// end send message


// login
function prepareLoginData() {
    if (!isValidMsisdn($('#msisdn').val())) {
        popUpMessage('Invalid MSISDN');
        return;
    }
    if (isEmpty($('#password').val())) {
        popUpMessage('Please enter password');
        return;
    }
    userLoginData = {
        "msisdn" : $('#msisdn').val(),
        "authCode" : SHA1($('#msisdn').val()+$('#password').val())
    };
    login(userLoginData);
}

function login(data) {
    
    
    $.ajax({
        url: serviceURL + "/login",
        type: "POST",
        timeout: 5000,
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(data),
        success: loginSuccess,
        error: loginFail
    });            
}

function loginSuccess(response) {
    popUpMessage('Logged in');
    if ($('#rememberMe').is(':checked')) {
        console.log('Remember me.');
        createCookie( 'rememberCookie', JSON.stringify(userLoginData), 30 );
        console.log('The cookie: ' + readCookie('rememberCookie'));
    } else {
        eraseCookie('rememberCookie');
    }
    setIntervalToGetMsgFromServer(time);
    redirectToHome(response);
}

function loginFail(err) {
    if (isEmpty(err['errorCode'])) {
        popUpMessage('Login failed');
        return;
    }
    popUpMessage(err['errorMsg']);
}
// end login


// register
function prepareRegistrationObject() {
    var pass = $('#newPass').val();
    var passRepeat = $('#newPassRepeat').val();
    var msisdn = $('#newMsisdn').val();

    if (!isValidMsisdn(msisdn)) {
        popUpMessage('Invalid MSISDN');
        return;
    }
    
    if (isEmpty(pass)) {
        popUpMessage('Please enter password');
        return;
    }
    
    if (passRepeat != pass) {
        popUpMessage("Passwords don't match");
        return;
    }
    
    var authCode = SHA1(msisdn + pass);
    var newRecord = {
        "msisdn":msisdn,
        "authCode":authCode
    };
    
    register(newRecord);
}

function register(newRecord) {
    
    $.ajax({
        url: serviceURL + "/register",
        type: "POST",
        timeout: 5000,
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(newRecord),
        success: registrationSuccess,
        error: registrationFail
    });
}

function registrationSuccess(response) {
    popUpMessage('Registration successful');
    redirectToHome(response);
}

function registrationFail(err) {
    if (isEmpty(err['errorCode'])) {
        popUpMessage('Registration failed');
        return;
    }
    popUpMessage(err['errorMsg']);
}
// end register


// logout
function logout() {
    
    $.ajax({
        url: serviceURL + "/logout/" + sessionID,
        type: 'GET',
        dataType: 'json',
        success: logoutSuccess,
        error: logoutFail
    });
    
}

function logoutSuccess(response) {
    destroyResources();
    popUpMessage('Logged out');
    window.location.replace("index.html#login");
}

function logoutFail(err) {
    destroyResources();
    if (isEmpty(err['errorMsg'])) {
        popUpMessage('Logged out unsafe');
    } else {
        popUpMessage(err['errorMsg']);   
    }
    window.location.replace("index.html#login");
}
// end logout



// get online users
function getUsers() {
    
    if(isEmpty(sessionID)) {
        return;
    }
    $.ajax({
        url: serviceURL + "/list-users/" + sessionID,
        type: 'GET',
        dataType: 'json',
        success: displayUsers,
        error: getUsersFail
    });
}

function displayUsers(response) {
    
    $('#usersOnlineListView').empty()
        .html('<ul data-role="listview" id="usersOnline" data-theme="a" data-filter="true" data-filter-theme="a"></ul>').trigger('create');
    for(i in response) {
        var msisdn = response[i];
        var name = 'Unknown';
        // TODO if name is familiar then set name
        $('#usersOnline').append('<li class="users" onclick="goToUser(\'' + msisdn + "\',\'" + name + '\');"><a href="#"><img src="img/user.png"/><h3>No: ' + msisdn + '</h3><p>Name: <span class="name">' + name +' </span><p></a></li>');
    }
    $('#usersOnline').listview('refresh');
}

function getUsersFail(err) {
    if (isEmpty(err['errorMsg'])) {
        popUpMessage('Fail to find users online');
    }
    else {    
        popUpMessage(err['errorMsg']);
    }
    $('usersOnlineListView').empty();
}
// end get online users


// go to user 
function goToUser(msisdn, name) {
    $('#profileData').empty();
    $('#profileData').append('<input type="hidden" value="' + msisdn + '" id="newMsisdnFromProfile">');
    $('#profileData').append('<p>You have selected the profile of ' + name + '</p><p>Number: ' + msisdn + '</p>');
    window.location.replace("index.html#userProfile");   
}


// redirect to home after login / register only
function redirectToHome(response) {
    sessionID = response['sessionID'];
    //loadHomeScreen();
    if (!isEmpty(sessionID) && sessionID.length <= 50) {
        window.location.replace('index.html#home');
        return;
    }
    popUpMessage('Error on login');
}

function loadHomeScreen() {
    $('#homePageContent').append('');
}

function isEmpty(value) {
    if(typeof value === 'undeined' || value == null || value == '') {
        return true;
    }
    return false;
}

// resource -> http://forum.jquery.com/topic/exposing-an-error-dialog
function popUpMessage(message){
   jQuery("<div class='ui-overlay-shadow ui-corner-all popup'><h1>" + message  + "</h1></div>")
       .css({ "display": "block", "opacity": 0.90 })
       .appendTo( '.popups' )
       .delay( 2100 )
       .fadeOut( 500, function(){
       $(this).remove();
   }); 
}
// end of resource

function setRefreshRate() {
    var temp = $('#refreshRateField').val();
    if (isEmpty(temp)) {
        popUpMessage('Please enter refresh rate');
        return;
    }
    if (!isValidNumber(temp)) {
        popUpMessage('Invalid refresh rate');
        return;
    }
    if (temp < 500) {
        popUpMessage('Min. refresh rate is 500ms');
        return;
    }
    if (temp > 300000) {
        popUpMessage('Max refresh rate is 300000ms (5 minutes)');
        return;
    }
    time = $('#refreshRateField').val();
    killTimer();
    setIntervalToGetMsgFromServer(time);
    prepareRefreshRate();
}

function setIntervalToGetMsgFromServer(newTime) {
    __timer = setInterval(getMsgsFromServer, newTime);
}

function killTimer() {
    clearInterval(__timer);
}
		
function popUpRequestDialog(msisdn){
    var message = msisdn + " wants to start chat with you.";
    jQuery('<div class="ui-overlay-shadow ui-corner-all popup" id="dialogPop"><p>' + message  + '</p>')
        .append('<a href="index.html#enterSecret" data-role="button" id="accept" data-inline="true" data-rel="dialog" data-transition="pop">Accept</a>')
        .append('<a href="ndex.html#declinePopup" data-role="button" id="decline" data-inline="true"  data-rel="dialog" data-transition="pop">Decline</a></div>')
        .css({ "display": "block", "opacity": 0.90 })
        .appendTo( '.popups' )
        .trigger('create');
}

// for slider
function makeAjaxChange( elem ) { 
    alert(elem.val()); 
}

function prepareSettings() {
    prepareRefreshRate();
    //prepareSlider();
}

function prepareRefreshRate() {
    $('#refreshRateHolder').empty()
        .append('<input placeholder="Current value: ' + time + 'ms" type="text" id="refreshRateField" class="centeredSettings" data-theme="a"/>').trigger('create');
    
}

function prepareSlider() {
    $('#sliderHolder').empty();
    $('#sliderHolder').append('<div data-role="fieldcontain">')
        .append('<input type="range" name="slider" id="slider" value="' + time + '" min="500" max="300000" data-theme="a" readonly="readonly"/>')
        .append('</div>')
        .css({ "display": "block"})
        .trigger('create');
}

function sendIM() {
    var message = escapeHtml($('#chatField').val());
    
    if (isEmpty(message)) {
        return;
    }
    
    $('#chatField').val('');
    try { 
        sendMessage(message);
        $('#chatWindow').append('<span class="myMessage"><span class="myName">Me:</span> ' + message + '</span><br/>').show();
    } catch (e) {
        popUpMessage('Be careful next time with those messages');
    }
}

function incommingIM(response) {
    var message = response['msgText'];
    message = escapeHtml(GibberishAES.dec(message, secretKey));
    if (isEmpty(message)) {
        return;
    }
    $('#chatWindow').append('<span class="incommingMessage"><span class="friendName">Friend:</span> ' + message + '</span><br/>').show();
}

function destroyResources() {
    killTimer();
    $('#usersOnlineListView').empty()
    $('#chatField').val('');
    $('#chatWindow').empty();
    sessionID = null;
    userLoginData = null;
    secretKey = null;
    randNumber = null;
    recepientMsisdn = null;
    invitation = null;
}

// validators
function isValidMsisdn(msisdn) {
    var regex = /^[+](3598)[0-9]{8}$/;
    return regex.test(msisdn);
}

function isValidNumber(number) {
    var regex = /^[0-9]{3,9}$/;
    return regex.test(number);
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

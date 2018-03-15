var linebot = require('linebot');
var express = require('express');
var google = require('googleapis');
var googleAuth = require('google-auth-library');

var bot = linebot({
  channelId: '<your channelId>',
  channelSecret: '<your channelSecret>',
  channelAccessToken: '<your channelAccessToken>'
});

var myClientSecret=<複製你的client_secret內容>

var auth = new googleAuth();
var oauth2Client = new auth.OAuth2(myClientSecret.installed.client_id,myClientSecret.installed.client_secret, myClientSecret.installed.redirect_uris[0]);

oauth2Client.credentials =<複製sheetapi.json檔案的內容>

var mySheetId='<google sheets ID>';

var myQuestions=[];
var users=[];
var totalSteps=0;
var myReplies=[];

//程式啟動後會去讀取試算表內的問題
getQuestions();


//這是讀取問題的函式
function getQuestions() {
  var sheets = google.sheets('v4');
  sheets.spreadsheets.values.get({
     auth: oauth2Client,
     spreadsheetId: mySheetId,
     range:encodeURI('問題'),
  }, function(err, response) {
     if (err) {
        console.log('讀取問題檔的API產生問題：' + err);
        return;
     }
     var rows = response.values;
     if (rows.length == 0) {
        console.log('No data found.');
     } else {
       myQuestions=rows;
       totalSteps=myQuestions[0].length;
       console.log('要問的問題已下載完畢！');
     }
  });
}

//這是將取得的資料儲存進試算表的函式
function appendMyRow(userId) {
   var request = {
      auth: oauth2Client,
      spreadsheetId: mySheetId,
      range:encodeURI('input'),
      insertDataOption: 'INSERT_ROWS',
      valueInputOption: 'RAW',
      resource: {
        "values": [
          users[userId].replies
        ]
      }
   };
   var sheets = google.sheets('v4');
   sheets.spreadsheets.values.append(request, function(err, response) {
      if (err) {
         console.log('The API returned an error: ' + err);
         return;
      }
   });
}

//LineBot收到user的文字訊息時的處理函式
bot.on('message', function(event) {
   if (event.message.type === 'text') {
      var myId=event.source.userId;
      if (users[myId]==undefined){
         users[myId]=[];
         users[myId].userId=myId;
         users[myId].step=-1;
         users[myId].replies=[];
      }
      var myStep=users[myId].step;
      if (myStep===-1)
         sendMessage(event,myQuestions[0][0]);
      else{
         if (myStep==(totalSteps-1))
            sendMessage(event,myQuestions[1][myStep]);
         else
            sendMessage(event,myQuestions[1][myStep]+'\n'+myQuestions[0][myStep+1]);
         users[myId].replies[myStep+1]=event.message.text;
      }
      myStep++;
      users[myId].step=myStep;
      if (myStep>=totalSteps){
         myStep=-1;
         users[myId].step=myStep;
         users[myId].replies[0]=new Date();
         appendMyRow(myId);
      }
   }
});


//這是發送訊息給user的函式
function sendMessage(eve,msg){
   eve.reply(msg).then(function(data) {
      // success 
      return true;
   }).catch(function(error) {
      // error 
      return false;
   });
}


const app = express();
const linebotParser = bot.parser();
app.post('/', linebotParser);

//因為 express 預設走 port 3000，而 heroku 上預設卻不是，要透過下列程式轉換
var server = app.listen(process.env.PORT || 8080, function() {
  var port = server.address().port;
  console.log("App now running on port", port);
});
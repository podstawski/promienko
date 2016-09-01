var attempts=20;
var attempt_delay=200;


//var hcrc = require('../common/hcrc8');


module.exports = function(com,ini,logger,callback) {
    var counter=0;
    var sendQueue=[];
    var sendSemaphore=false;
    var buf='';
    var self=this;
    var sendTimers=[];
    var database;
    var deviceId;

    
    var crc = function (cmd) {

    }
    
    var deletefuture = function (params) {
        for (var i=0; i<sendQueue.length; i++) {
            if (sendQueue[i].str.length>0) continue;
            if (sendQueue[i].when - Date.now() < 500) continue;
            
            var pass=true;
            for (var k in params) {
                if (params[k]!=sendQueue[i].cmd[k]) {
                    pass=false;
                    break;
                }
            }
            if (pass) {
                sendQueue.splice(i,1);
                i--;
            }
        }
        
    }
    
    var pkt = function() {
        counter=(counter%255)+1;
        return counter;
    }
    
    var send = function(cmd,delay) {

        for (var i=0; i<sendTimers.length; i++) {
            clearTimeout(sendTimers[i]);
        }
        sendTimers=[];
        
        var now=Date.now();
        
        if (delay==null) delay=0;
        
        if (cmd!=null) {    
            sendQueue.push({str: '', sent: 0, count: 0, when:now+1000*parseFloat(delay), search: '', cmd: cmd});
        }
        
        if (sendSemaphore) {
            sendTimers.push(setTimeout(send,10));
            return;
        }
        
        sendSemaphore=true;
        var nextHop=10000;
        
        for (var i=0; i<sendQueue.length; i++) {
            if ( sendQueue[i].when > now) {
                if (sendQueue[i].when-now < nextHop) {
                    nextHop=sendQueue[i].when-now;
                }
                continue;
            }
            
            if ( now-sendQueue[i].sent < attempt_delay) {
                if (nextHop > attempt_delay-now+sendQueue[i].sent) {
                    nextHop = attempt_delay-now+sendQueue[i].sent;
                }
                continue;
            }
            if ( sendQueue[i].count>=attempts) continue;
            
            if (sendQueue[i].str.length==0) {
                var arr=new Array;
                
                /*
                arr[pos_cmd]=sendQueue[i].cmd.cmd;
                arr[pos_val]=sendQueue[i].cmd.val;
                arr[pos_src]='0';
                arr[pos_dst]=sendQueue[i].cmd.dst;
                arr[pos_pkt]=pkt();
                arr[pos_top]='s';
                arr[pos_crc]=crc(arr);
                
                sendQueue[i].str='<;'+arr.join(';')+';>';
                sendQueue[i].search = arr[pos_cmd]+':'+arr[pos_dst]+':'+arr[pos_pkt];
                */
            }
                
            var msg=sendQueue[i].str;
            var res=com.send(msg+"\r\n");
            if (!res) {
                sendQueue[i].when=now+1000;
                if (nextHop>1000) nextHop=1000;
            } else {
                sendQueue[i].count++;
                sendQueue[i].sent=now;
                logger.log('Sending: '+msg,'frame');
            }
            
            
        }
        
        for (var i=0; i<sendQueue.length; i++) {
            
            if ( now-sendQueue[i].sent<attempt_delay) continue;
            
            if ( sendQueue[i].count>=attempts ) {
                sendQueue.splice(i,1);
                i--;
                continue;
            }
             
        }
        
        sendSemaphore=false;
        if (sendQueue.length>0) sendTimers.push(setTimeout(send,nextHop));
        
    }
    
    
    
    var hset = function(data,delay2,ctx) {
    };
    
    var toggle = function(data) {
        
        return rec.value;
    };
    
    
    return {
        
        'set': function(data,delay,ctx) {
            
            if (typeof(data.value)=='undefined') data.value=toggle(data);
            
            return hset(data,delay,ctx);
        },
        
        'data': function(data) {
            console.log(data);            
        },
        'initstate': function (db) {
            database=db;
        },
        
        'dbready': function(db) {
            setTimeout(function() {
                outputs=db.ios.select([{device: deviceId, io: 'o', value: ['=',[1,'1']]}]);
            
                logger.log('Initializing outputs: '+outputs.recordsTotal,'init');
                
                for (var i in outputs.data) {
                    hset(outputs.data[i]);
                    logger.log(outputs.data[i].name+' ON','init');
                }

            },1000);
            
        },
        
        'setId': function (id) {
            deviceId = id;
        },
        
        'ctrlz': function() {
            for (var i in sendQueue) {
                sendQueue[i].seconds2go = Math.round((sendQueue[i].when - Date.now())/1000);
            }
            console.log('HK:',sendQueue);
        },
        
        'cancel': function(ctx,delay) {
            setTimeout(function(){
                for (var i=0; i<sendQueue.length; i++) {
                    if (sendQueue[i].cmd.ctx==ctx) {
                        sendQueue.splice(i,1);
                        i--;
                    }
                }
                
            },delay*1000);
        }
    }
    
}
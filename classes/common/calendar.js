var ical = require('ical');

module.exports = function(logger,script) {

    var calendars=[];
    var events=[];
    
    var convertTo24Hour = function (time) {
        
        var hours = parseInt(time.substr(0, 2));
        if(time.indexOf('am') != -1 && hours == 12) {
            time = time.replace('12', '0');
        }
        if(time.indexOf('pm')  != -1 && hours < 12) {
            time = time.replace(hours, (hours + 12));
        }
        return time.replace(/(am|pm)/, '');
    }
    

    return {
        reggister: function(cals) {
            calendars=cals;
        },
        
        update: function() {
            var now=Date.now();
            var backup=events.slice(0,events.length);
            events=[];
            for (var i=0;i<calendars.length;i++) {
                ical.fromURL(calendars[i], {}, function(err, data) {

                    if (typeof(err)!='undefined') {
                        events=backup.slice(0,backup.length);
                        logger.log('Problem with calendar '+calendars[i],'calendar');
                        return;
                    }
                    
                    
                    
                    for (var k in data){
                        if (data.hasOwnProperty(k)) {
                            var ev = data[k];
                            if (typeof(ev.start)=='undefined') continue;
                            
                            var start=ev.start.getTime();
                            var end=ev.end.getTime();
                            var duration_ms=end-start;
                            var duration=duration_ms/3600000;
                            
                            if (typeof(ev.rrule)!='undefined' && end<now) {
                                var starts=ev.rrule.between(new Date(new Date().getTime()-3600*1000),new Date(new Date().getTime()+24*3600*1000));
                                
                                if (starts.length>0) {
                                    var nStart=starts[0];
                                    
                                    nStart.setHours(ev.start.getHours());
                                    nStart.setMinutes(ev.start.getMinutes());
                                    nStart.setSeconds(ev.start.getSeconds());
                                
                                    start=nStart.getTime();
                                    end=start+duration_ms;
                                    ev.start=new Date(start);
                                    ev.end=new Date(end);
                                    
                                }
                                
                            };
                            
                            
                            if (end < now) continue;
                            if (start > now+24*3600*1000) continue;
                            
                            

                            if (duration>=23 && duration<=25) {
                            
                                
                                if (ev.summary.indexOf('unrise')>=0 && ev.summary.indexOf('unset')>=0) {
                                   
                                    var a=ev.summary.split(',');
                                    for (var j=0;j<a.length; j++) {
                                        a[j]=a[j].trim();
                                        var colon=a[j].indexOf(':');
                                        if (colon>0) {
                                            
                                            var today = new Date(start+(end-start)/2).toString();
                                            var colon2=today.indexOf(':');
                                            today=today.substr(0,colon2-2).trim();
                                            var str=today+' '+convertTo24Hour(a[j].substr(colon+1)).trim()+' GMT';
                                            var d=new Date(Date.parse(str));
                                            if (d.getTime()<now) continue;
                                            var id=script.find(a[j].substr(0,colon));
                    
                                            if (id!=null) {
                                                events.push({when:d,script:id});
                                            } else {
                                                logger.log('Script "'+a[j].substr(0,colon)+'" unrecognizable','calendar');
                                            }
                                            
                                        }
                                        
                                    }
                                }
                            } else {
                                var id=script.find(ev.summary);
                                if (id==null) {
                                    logger.log('Script "'+ev.summary+'" unrecognizable','calendar');
                                } else {
                                    if (typeof(id)=='object') {
                                        if (ev.start.getTime()>now) events.push({when:ev.start,script:id[0]});
                                        if (ev.end.getTime()>now) events.push({when:ev.end,script:id[1]});
                                        
                                    } else {
                                        if (ev.start.getTime()>now) events.push({when:ev.start,script:id});
                                    }
                                
                                }
                            }
                            
                            
                          
                        }
                    }                
                
                });
            }
            
        },
        
        run: function() {
            
            var now=Date.now();
            for (var i=0;i<events.length;i++) {
                var when=events[i].when.getTime();
                
                if (Math.abs(now-when)<10000) {
                    script.run(events[i].script,0);
                    
                }
                if (when<now) {
                    events.splice(i,1);
                    i--;
                }
            }
            
        }
    }
}
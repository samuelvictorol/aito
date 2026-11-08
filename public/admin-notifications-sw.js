self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>event.waitUntil((async()=>{
 let data;try{data=event.data.json()}catch{return}
 if(data?.type!=='aito.admin-purchase'||typeof data.title!=='string'||typeof data.body!=='string'||data.title.length>100||data.body.length>280||! /^[a-f0-9]{24}$/i.test(data.id||''))return;
 const tag='aito-purchase-'+data.id;if((await self.registration.getNotifications({tag})).length)return;
 await self.registration.showNotification(data.title,{body:data.body,icon:'/aito-logo-restored.png',badge:'/comunicacao/app/icons/notify-badge.png',tag,data:{url:'/admin'}})
})()));
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{const url=self.location.origin+'/admin';const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=windows.find(c=>c.url.startsWith(url)&&c.frameType!=='nested');if(client){await client.focus();await client.navigate(url)}else await self.clients.openWindow(url)})())});

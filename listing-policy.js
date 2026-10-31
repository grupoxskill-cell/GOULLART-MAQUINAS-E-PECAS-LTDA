function listingDay(value){
 if(typeof value!=='string'||!value.trim())return null;
 if(/^\d{4}-\d{2}-\d{2}$/.test(value)){const n=Date.parse(value+'T12:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===value?value:null}
 const n=Date.parse(value);return Number.isFinite(n)?new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(n):null;
}
function recentListingDate(value,now=Date.now()){
 const day=listingDay(value);if(!day)return false;
 const today=listingDay(new Date(now).toISOString());const cutoff=new Date(Date.parse(today+'T12:00:00Z')-30*86400000).toISOString().slice(0,10);
 return day>=cutoff&&day<=today;
}
function listingHasPhoto(item){return typeof item?.image==='string'&&!!item.image.trim()||Array.isArray(item?.media)&&item.media.some(m=>m?.kind==='image'&&typeof m.url==='string'&&!!m.url.trim())}
function eligibleListing(item,now=Date.now()){return !!item&&(item.opportunitySummary===true&&item.category==='locacao'||item.category==='pecas'&&item.catalogItem===true||listingHasPhoto(item)&&(item.retentionPolicy==='owner_confirmation'?!!listingDay(item.publishedAt||item.date):recentListingDate(item.publishedAt||item.date,now)))}
globalThis.GoullartListingPolicy={listingDay,recentListingDate,listingHasPhoto,eligibleListing};

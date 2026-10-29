// All browser test mutations are intercepted; no OTP, booking, or payment is sent.
const source = String.raw`
    window.__bookingTestVisit=crypto.randomUUID();
    const user={id:'terms-layout-fixture',firstName:'Test',lastName:'Traveller',email:'terms@example.test',mobileNumber:'919000000000',gender:'female',dateOfBirth:'1990-01-01',nationality:'Indian',roles:['traveller'],status:'active',isMobileVerified:true,createdAt:'2026-01-01',updatedAt:'2026-01-01'};
    localStorage.setItem('ancient_trails_token','terms-test-session-do-not-send');
    localStorage.setItem('ancient_trails_user',JSON.stringify(user));
    window.__blockedTestWrites=[];
    const originalFetch=window.fetch;
    window.fetch=async(...args)=>{
      const url=String(args[0]),method=(args[1]?.method||'GET').toUpperCase();
      if(url.includes('/api/') && method!=='GET') {
        window.__blockedTestWrites.push({url,method});
        return new Response(JSON.stringify({success:false,message:'Test writes blocked'}),{status:400,headers:{'Content-Type':'application/json'}});
      }
      if(NORMALIZE_DEPARTURE && url.includes('/api/tours/departures')) {
        const response=await originalFetch(...args),body=await response.json();
        const start=Date.now()+45*86400000;
        body.data.departures=body.data.departures.map(d=>d.departureId==='DEP014'?{...d,status:'scheduled',departureDate:new Date(start).toISOString(),returnDate:new Date(start+5*86400000).toISOString(),bookingDeadline:new Date(start-15*86400000).toISOString(),priceAdult:40000,singleOccupancy:52000,totalSeats:25,filledSeats:0,seatsAvailable:25,validationErrors:[]}:d);
        return new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
      }
      if(url.includes('/api/auth/'))return new Response(JSON.stringify({success:true,data:{user,token:'terms-test-session-do-not-send'}}),{headers:{'Content-Type':'application/json'}});
      if(url.includes('/api/notifications'))return new Response(JSON.stringify({success:true,data:{notifications:[],unreadCount:0}}),{headers:{'Content-Type':'application/json'}});
      return originalFetch(...args);
    };`;
exports.installBookingFixture = async (client, normalizeDeparture = false) => {
  await client.send("Page.addScriptToEvaluateOnNewDocument", { source: "(() => {" + source.replace("NORMALIZE_DEPARTURE", String(normalizeDeparture)) + "})();" });
};
exports.advanceBookingTo = async (evaluate, waitFor, target) => {
  const stage = () => evaluate("Number(document.querySelector('nav[aria-label=\"Booking steps\"] [aria-current=\"step\"] span')?.textContent)");
  while (await stage() < target) {
    const current = await stage();
    await waitFor("Boolean(document.querySelector('[data-mobile-booking-bar] button:not(:disabled)'))", "enabled Continue");
    await evaluate("document.querySelector('[data-mobile-booking-bar] button').click()");
    await waitFor("Number(document.querySelector('nav[aria-label=\"Booking steps\"] [aria-current=\"step\"] span')?.textContent) === " + (current + 1), "booking step " + (current + 1));
  }
};
exports.navigateBookingTour = async (client, evaluate, waitFor, url) => {
  const previous = await evaluate("window.__bookingTestVisit || ''");
  await client.send("Page.navigate", { url });
  await waitFor("Boolean(window.__bookingTestVisit) && window.__bookingTestVisit !== " + JSON.stringify(previous) + " && Boolean(document.body)", "new tour document");
};

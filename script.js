/* ---------- Settings ---------- */
// Labels in the same order as the model's classes_ (confirmed from your .pkl).
const CLASSES = ["Entire home/apt", "Private room", "Shared room"];

const HOODS = {
  "Manhattan":["Harlem","East Village","Upper West Side","Upper East Side","Midtown","Hell's Kitchen","Chelsea","Lower East Side","West Village","Washington Heights"],
  "Brooklyn":["Williamsburg","Bedford-Stuyvesant","Bushwick","Crown Heights","Greenpoint","Park Slope","Flatbush","Clinton Hill","Sunset Park"],
  "Queens":["Astoria","Long Island City","Flushing","Ridgewood","Sunnyside","Jamaica","Woodside","Forest Hills"],
  "Bronx":["Mott Haven","Kingsbridge","Fordham","Concourse","Longwood","Riverdale"],
  "Staten Island":["St. George","Tompkinsville","Stapleton","New Brighton","Great Kills"]
};
const PRESETS = {
  manhattan:{neighbourhood_group:"Manhattan",neighbourhood:"Midtown",latitude:40.7549,longitude:-73.984,price:240,minimum_nights:3,availability_365:220,number_of_reviews:58,reviews_per_month:1.4,calculated_host_listings_count:2},
  brooklyn:{neighbourhood_group:"Brooklyn",neighbourhood:"Bedford-Stuyvesant",latitude:40.6872,longitude:-73.9418,price:75,minimum_nights:2,availability_365:150,number_of_reviews:34,reviews_per_month:0.9,calculated_host_listings_count:1},
  queens:{neighbourhood_group:"Queens",neighbourhood:"Astoria",latitude:40.7644,longitude:-73.9235,price:42,minimum_nights:1,availability_365:300,number_of_reviews:12,reviews_per_month:0.5,calculated_host_listings_count:4}
};
const STEP_FIELDS = [
  ["neighbourhood_group","neighbourhood","latitude","longitude"],
  ["price","minimum_nights","availability_365"],
  ["number_of_reviews","reviews_per_month","calculated_host_listings_count"]
];
const INTS = ["minimum_nights","number_of_reviews","calculated_host_listings_count","availability_365"];
const FLOATS = ["latitude","longitude","price","reviews_per_month"];

// Change this to your deployed API address when you go live.
const API_URL = "http://127.0.0.1:8000";

const $ = id => document.getElementById(id);
const $$ = s => [...document.querySelectorAll(s)];
const base = () => API_URL.replace(/\/+$/,"");
let cur = 0;

/* ---------- Headline word-by-word entrance ---------- */
(() => {
  const h = $("headline"), words = h.textContent.split(" ");
  h.innerHTML = words.map((w,i) =>
    `<span class="w ${w.startsWith("before")?"hl":""}"><span style="animation-delay:${i*90+150}ms">${w}</span></span>`).join(" ");
})();

/* ---------- Cursor glow ---------- */
addEventListener("pointermove", e => {
  document.documentElement.style.setProperty("--mx", e.clientX+"px");
  document.documentElement.style.setProperty("--my", e.clientY+"px");
});


/* ---------- Borough pills + suggestions ---------- */
function setBorough(v){
  $("neighbourhood_group").value = v;
  $$(".pill").forEach(p => { const on = p.dataset.v === v; p.classList.toggle("on",on); p.setAttribute("aria-checked",on); });
  $("hoods").innerHTML = (HOODS[v]||[]).map(h => `<option value="${h}">`).join("");
}
$$(".pill").forEach(p => p.addEventListener("click", () => setBorough(p.dataset.v)));

/* ---------- Sliders ---------- */
const sync = () => { $("o_min").textContent = $("minimum_nights").value; $("o_av").textContent = $("availability_365").value; };
["minimum_nights","availability_365"].forEach(id => $(id).addEventListener("input", sync));

/* ---------- Presets ---------- */
$$("[data-preset]").forEach(b => b.addEventListener("click", () => {
  const p = PRESETS[b.dataset.preset];
  Object.entries(p).forEach(([k,v]) => { if(k!=="neighbourhood_group") $(k).value = v; });
  setBorough(p.neighbourhood_group); sync(); $$(".bad").forEach(e => e.classList.remove("bad"));
  $("msg").textContent = "Example loaded. Step through to review, or jump to the last step and predict.";
  $("form").scrollIntoView({behavior:"smooth",block:"center"});
}));

/* ---------- Stepper ---------- */
function go(n, back=false){
  cur = n;
  $$(".step").forEach((s,i) => { s.classList.toggle("show", i===n); s.classList.toggle("back", back); });
  $$(".s").forEach((s,i) => { s.classList.toggle("on", i===n); s.classList.toggle("done", i<n); });
  $("progress").style.width = ((n+1)/3*100)+"%";
  $("back").disabled = n===0;
  $("next").hidden = n===2; $("predict").hidden = n!==2;
  $("msg").textContent = "";
}
function validStep(n){
  let ok = true;
  STEP_FIELDS[n].forEach(id => {
    const el = $(id);
    const bad = !el.value.trim() || (el.type==="number" && !el.checkValidity());
    if(el.type!=="hidden") el.classList.toggle("bad",bad);
    if(bad) ok = false;
  });
  if(!ok) $("msg").textContent = n===0 && !$("neighbourhood_group").value ? "Pick a borough and fill every field."
        : "Fill every field with a value in range.";
  return ok;
}
$("next").addEventListener("click", () => validStep(cur) && go(cur+1));
$("back").addEventListener("click", () => go(cur-1,true));
$$(".s").forEach(b => b.addEventListener("click", () => {
  const t = +b.dataset.go;
  if(t<=cur) go(t,true);
  else { for(let i=cur;i<t;i++) if(!validStep(i)){ go(i); return; } go(t); }
}));
$("form").addEventListener("input", e => e.target.classList.remove("bad"));
$("form").addEventListener("keydown", e => { if(e.key==="Enter" && cur<2){ e.preventDefault(); $("next").click(); } });

/* ---------- Predict ---------- */
$("form").addEventListener("submit", async e => {
  e.preventDefault();
  for(let i=0;i<3;i++) if(!validStep(i)){ go(i); return; }
  const body = {};
  ["neighbourhood_group","neighbourhood"].forEach(k => body[k] = $(k).value.trim());
  INTS.forEach(k => body[k] = parseInt($(k).value,10));
  FLOATS.forEach(k => body[k] = parseFloat($(k).value));

  const btn = $("predict"); btn.disabled = true; btn.classList.add("loading"); $("ptext").textContent = "Predicting…";
  try{
    const r = await fetch(base()+"/predict",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data = await r.json();
    if(!r.ok) throw new Error(Array.isArray(data.detail) ? data.detail.map(x => (x.loc||[]).slice(-1)+": "+x.msg).join("; ") : (data.detail||"Request failed"));
    showResult(data);
  }catch(err){
    $("msg").textContent = err instanceof TypeError
      ? "We couldn't reach the prediction service. Please try again in a moment."
      : "Please check your details and try again. ("+err.message+")";
  }finally{
    btn.disabled = false; btn.classList.remove("loading"); $("ptext").textContent = "Predict room type";
  }
});

/* ---------- Result ---------- */
function showResult(data){
  const probs = data.Probability || [], top = Math.max(...probs);
  $("label").textContent = data.Predicted_room_type;
  $("bars").innerHTML = probs.map((p,i) => ({n:CLASSES[i]||"Class "+(i+1),p})).sort((a,b) => b.p-a.p).map((r,i) => `
    <div class="b ${i===0?"top":""}"><div class="r"><span></span><span>${(r.p*100).toFixed(1)}%</span></div>
    <div class="tr"><div class="fl" data-w="${(r.p*100).toFixed(1)}"></div></div></div>`).join("");
  $$("#bars .r span:first-child").forEach((s,i) => s.textContent =
    probs.map((p,j) => ({n:CLASSES[j]||"Class "+(j+1),p})).sort((a,b) => b.p-a.p)[i].n);

  const ov = $("overlay"); ov.classList.add("open"); ov.setAttribute("aria-hidden","false");
  const arc = $("arc"), pct = $("pct");
  arc.style.strokeDashoffset = 339.3; pct.textContent = 0;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    arc.style.strokeDashoffset = 339.3*(1-top);
    $$("#bars .fl").forEach(f => f.style.width = f.dataset.w+"%");
  }));
  const t0 = performance.now(), dur = 1400;               // count-up
  (function tick(t){ const k = Math.min((t-t0)/dur,1), e = 1-Math.pow(1-k,3);
    pct.textContent = Math.round(top*100*e); if(k<1) requestAnimationFrame(tick); })(t0);
  $("again").focus();
}
function closeResult(reset){
  const ov = $("overlay"); ov.classList.remove("open"); ov.setAttribute("aria-hidden","true");
  if(reset){ $("form").reset(); setBorough(""); sync(); go(0,true); }
}
$("edit").addEventListener("click", () => closeResult(false));
$("again").addEventListener("click", () => closeResult(true));
addEventListener("keydown", e => e.key==="Escape" && closeResult(false));

go(0); sync();

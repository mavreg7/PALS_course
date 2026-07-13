// peds_sedation/course-news.js — automatic "What's new" notice for participants.
//
// Bump `v` (and update the text) whenever course materials/content are added or
// changed. Every participant — students and staff — then sees a banner on their
// next visit to the hub, until they dismiss it. Loaded as a classic script by
// both hubs AFTER the peds storage shim, so `news_seen_v` is namespaced to
// peds_. This complements the manual "Broadcast Announcement" tool (which staff
// use for ad-hoc messages); this one fires automatically on content updates.
window.PEDS_NEWS = {
  v: 1,
  he: 'נוספו חומרי קורס חדשים — מצגות (כאב וחרדה, עקרונות בטיחות, פרמקולוגיה) והנחיות/חוזרים של משרד הבריאות. ראו במדור "חומרי הקורס".',
  en: 'New course materials added — presentations and MOH guidelines/circulars. See "Course Materials".'
};

(function(){
  function initNews(){
    try{
      var n = window.PEDS_NEWS; if(!n || !n.v) return;
      var banner = document.getElementById('news-banner'); if(!banner) return;
      var seen = parseInt(localStorage.getItem('news_seen_v') || '0', 10) || 0;
      if(seen >= n.v) return;                     // already seen this update
      var txt = document.getElementById('news-txt');
      if(txt) txt.textContent = '🆕 ' + (n.he || n.en || '');
      banner.style.display = 'flex';
      var x = document.getElementById('news-x');
      if(x) x.onclick = function(){
        try{ localStorage.setItem('news_seen_v', String(n.v)); }catch(e){}
        banner.style.display = 'none';
      };
    }catch(e){ /* never block the hub on a notice */ }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initNews);
  else initNews();
})();

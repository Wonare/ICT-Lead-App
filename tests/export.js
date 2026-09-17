const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const assert = require('node:assert/strict');
(async () => {
  const html = fs.readFileSync('admin/leads.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'');
  const dom = new JSDOM(html,{url:'http://localhost:3000/admin/leads.html',runScripts:'outside-only',virtualConsole:new VirtualConsole()});
  const w = dom.window;

  let exportCalls = 0, blobParts;
  w.AdminAPI = {
    requireAuth: async () => ({full_name:'Test Admin'}),
    clearSession() {},
    get: async url => {
      if (url === '/api/admin/courses') return {data:{courses:[]}};
      const query = new URL(url,'http://localhost').searchParams;
      const exporting = query.get('limit') === '1000';
      if (exporting) exportCalls++;
      return {data:{leads:exporting ? [{id:query.get('page'),full_name:'Test',phone:'+2348012345678',notes:'=2+2'}] : [],pagination:{page:1,totalPages:exporting ? 2 : 1,total:exporting ? 2 : 0,limit:10}}};
    }
  };
  w.Blob = class { constructor(parts) { blobParts = parts; } };
  w.URL.createObjectURL = () => 'blob:test'; w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {};
  w.mockAPI = w.AdminAPI;
  w.eval(fs.readFileSync('admin/js/admin.js','utf8') + '\nAdminAPI = window.mockAPI;\n' + fs.readFileSync('admin/js/leads.js','utf8'));
  w.document.getElementById('exportBtn').click();
  await new Promise(r=>setTimeout(r,100));
  assert.equal(exportCalls,2);
  assert.ok(blobParts[0].includes("'=2+2"));
  assert.ok(blobParts[0].includes("'+2348012345678"));
  assert.equal(blobParts[0].split('\n').length,3);
  assert.equal(w.document.getElementById('exportBtn').disabled,false);
  dom.window.close();
  console.log('PASS CSV pagination, formula escaping and export button reset');
})().catch(e => {console.error(e);process.exitCode=1;});

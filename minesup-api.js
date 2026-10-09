'use strict';
/* ADI MINESUP Applications API Module — @adiuniversity.com Backend Handlers */

module.exports = function (app, db, utils) {
  utils = utils || {};

  function isMinesupOfficer(user) {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    if (user.permissions && user.permissions.manage_students) return true;
    return false;
  }

  // 1. GET /api/minesup/desk - Retrieve User / Admin MINESUP Desk
  app.get('/api/minesup/desk', async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const msCollection = db.collection('msapp');
      const officer = isMinesupOfficer(user);

      const myApp = await msCollection.findOne({ userId: user.id });

      let rows = [];
      if (officer) {
        rows = await msCollection.find({}).sort({ submittedAt: -1 }).toArray();
      }

      res.json({
        officer,
        mine: myApp || null,
        rows: officer ? rows : []
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 2. POST /api/minesup/apply - Submit MINESUP Transcript / Diploma Request
  app.post('/api/minesup/apply', async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { kind, program, session, phone, docs } = req.body || {};
      if (!kind || !program || !session) {
        return res.status(400).json({ error: 'Application type, program, and exam session are required.' });
      }

      const msCollection = db.collection('msapp');
      
      const appDoc = {
        id: 'ms_' + Math.random().toString(36).substr(2, 9),
        ref: 'MINESUP-' + Math.floor(10000 + Math.random() * 90000),
        userId: user.id,
        userName: user.fullName || user.name || user.username,
        userEmail: user.email || '',
        matric: user.matric || 'PENDING',
        kind, // 'transcript' | 'diploma'
        program,
        session,
        phone: phone || '',
        docs: docs || {},
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await msCollection.updateOne(
        { userId: user.id },
        { $set: appDoc },
        { upsert: true }
      );

      res.json({ ok: true, app: appDoc });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 3. POST /api/minesup/review - Approve or Reject Application (Officer Only)
  app.post('/api/minesup/review', async (req, res) => {
    try {
      const user = req.user;
      if (!isMinesupOfficer(user)) return res.status(403).json({ error: 'Forbidden' });

      const { id, status, note } = req.body || {};
      if (!id || !['approved', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Valid application ID and review status required.' });
      }

      const msCollection = db.collection('msapp');
      const target = await msCollection.findOne({ id });
      if (!target) return res.status(404).json({ error: 'Application record not found.' });

      await msCollection.updateOne(
        { id },
        { 
          $set: { 
            status, 
            reviewNote: note || '', 
            reviewedBy: user.fullName || user.name || user.id,
            reviewedAt: new Date().toISOString() 
          } 
        }
      );

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });
};

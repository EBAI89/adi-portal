'use strict';
/* ADI Institutional Mail API Module — @adiuniversity.com Backend Handlers */

module.exports = function (app, db, utils) {
  utils = utils || {};

  function generateOTP() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function slugify(name) {
    if (!name) return 'user';
    const parts = name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/);
    if (parts.length === 1) return parts[0].replace(/[^a-z0-9]/g, '');
    const surname = parts[0].replace(/[^a-z0-9]/g, '');
    const given = parts[1].replace(/[^a-z0-9]/g, '');
    return `${surname}.${given}`;
  }

  function isMailOfficer(user, acl) {
    if (!user) return false;
    if (user.role === 'super_admin') return true;
    if (user.role === 'admin' && acl && acl.admin !== false) return true;
    if (acl && Array.isArray(acl.people)) {
      return acl.people.some(p => p.email && p.email.toLowerCase() === (user.email || '').toLowerCase());
    }
    return false;
  }

  // 1. GET /api/mail/desk - Retrieve Mailbox Desk Data
  app.get('/api/mail/desk', async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const mailboxCollection = db.collection('mailbox');
      const aclCollection = db.collection('acl');
      const usersCollection = db.collection('users');

      const aclDoc = (await aclCollection.findOne({ _id: 'mail_acl' })) || { admin: true, people: [] };
      const officer = isMailOfficer(user, aclDoc);

      const myMail = await mailboxCollection.findOne({ userId: user.id, status: { $ne: 'revoked' } });

      let rows = [];
      let waiting = [];
      let hired = [];

      if (officer) {
        rows = await mailboxCollection.find({ status: { $ne: 'revoked' } }).sort({ issuedAt: -1 }).toArray();
        
        const existingUserIds = new Set(rows.map(r => r.userId).filter(Boolean));
        const admittedStudents = await usersCollection.find({ role: 'student', status: 'admitted' }).toArray();
        waiting = admittedStudents.filter(s => !existingUserIds.has(s.id)).map(s => ({
          userId: s.id,
          name: s.fullName || s.name || s.username,
          matric: s.matric || s.ref || 'N/A',
          status: s.status
        }));

        const staffList = await usersCollection.find({ role: { $in: ['lecturer', 'staff'] }, status: 'active' }).toArray();
        hired = staffList.filter(s => !existingUserIds.has(s.id)).map(s => ({
          id: s.id,
          name: s.fullName || s.name || s.username,
          ref: s.ref || s.matric || 'STAFF',
          title: s.title || s.role
        }));
      }

      res.json({
        officer,
        super: user.role === 'super_admin',
        mine: myMail || null,
        rows: officer ? rows : [],
        waiting: officer ? waiting : [],
        hired: officer ? hired : [],
        acl: user.role === 'super_admin' ? aclDoc : null
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 2. POST /api/mail/setup - Activate Mailbox with OTP & Password
  app.post('/api/mail/setup', async (req, res) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { otp, password, password2 } = req.body || {};
      if (!otp || !password) return res.status(400).json({ error: 'OTP and new password are required.' });
      if (password !== password2) return res.status(400).json({ error: 'Passwords do not match.' });
      if (password.length < 10 || !/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
        return res.status(400).json({ error: 'Password must be at least 10 characters with letters and numbers.' });
      }

      const mailboxCollection = db.collection('mailbox');
      const m = await mailboxCollection.findOne({ userId: user.id, status: 'pending_setup' });
      if (!m) return res.status(404).json({ error: 'No pending mailbox found for this account.' });

      if (m.otp.trim().toUpperCase() !== otp.trim().toUpperCase()) {
        return res.status(400).json({ error: 'Invalid one-time password.' });
      }

      const hashedPassword = typeof utils.hashPassword === 'function' ? utils.hashPassword(password) : password;
      await mailboxCollection.updateOne(
        { _id: m._id },
        { 
          $set: {              status: 'active',              passwordHash: hashedPassword,              activatedAt: new Date().toISOString()            },$unset: { otp: "" }
        }
      );

      res.json({ ok: true, message: 'Mailbox activated successfully.' });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 3. POST /api/mail/issue - Issue @adiuniversity.com Email Address
  app.post('/api/mail/issue', async (req, res) => {
    try {
      const user = req.user;
      const aclCollection = db.collection('acl');
      const aclDoc = (await aclCollection.findOne({ _id: 'mail_acl' })) || { admin: true, people: [] };
      if (!isMailOfficer(user, aclDoc)) return res.status(403).json({ error: 'Forbidden' });

      const { userId, hrId } = req.body || {};
      const targetId = userId || hrId;
      if (!targetId) return res.status(400).json({ error: 'Target user ID is required.' });

      const usersCollection = db.collection('users');
      const targetUser = await usersCollection.findOne({ id: targetId });
      if (!targetUser) return res.status(404).json({ error: 'User not found.' });

      const mailboxCollection = db.collection('mailbox');
      const existing = await mailboxCollection.findOne({ userId: targetUser.id, status: { $ne: 'revoked' } });
      if (existing) return res.status(400).json({ error: 'Mailbox already issued for this user.' });

      const handle = slugify(targetUser.fullName || targetUser.name);
      let email = `${handle}@adiuniversity.com`;

      let count = 1;
      while (await mailboxCollection.findOne({ email })) {
        email = `${handle}${count}@adiuniversity.com`;
        count++;
      }

      const otp = generateOTP();
      const doc = {
        id: 'mb_' + Math.random().toString(36).substr(2, 9),
        ref: 'ADI-MB-' + Math.floor(1000 + Math.random() * 9000),
        userId: targetUser.id,
        name: targetUser.fullName || targetUser.name,
        email,
        personalEmail: targetUser.email || '',
        matric: targetUser.matric || targetUser.ref || 'N/A',
        kind: targetUser.role || 'student',
        status: 'pending_setup',
        otp,
        issuedAt: new Date().toISOString()
      };

      await mailboxCollection.insertOne(doc);
      res.json({ ok: true, mailbox: doc });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 4. POST /api/mail/action - Modify Status (Suspend, Restore, Reset OTP, Rename)
  app.post('/api/mail/action', async (req, res) => {
    try {
      const user = req.user;
      const aclCollection = db.collection('acl');
      const aclDoc = (await aclCollection.findOne({ _id: 'mail_acl' })) || { admin: true, people: [] };
      if (!isMailOfficer(user, aclDoc)) return res.status(403).json({ error: 'Forbidden' });

      const { action, id, newEmail } = req.body || {};
      const mailboxCollection = db.collection('mailbox');
      const target = await mailboxCollection.findOne({ id });
      if (!target) return res.status(404).json({ error: 'Mailbox record not found.' });

      if (action === 'suspend') {
        await mailboxCollection.updateOne({ id }, { $set: { status: 'suspended', updatedAt: new Date().toISOString() } });
      } else if (action === 'restore') {
        await mailboxCollection.updateOne({ id }, { $set: { status: target.passwordHash ? 'active' : 'pending_setup', updatedAt: new Date().toISOString() } });
      } else if (action === 'reset') {
        const newOtp = generateOTP();
        await mailboxCollection.updateOne({ id }, { $set: { otp: newOtp, status: 'pending_setup', updatedAt: new Date().toISOString() } });
      } else if (action === 'rename') {
        if (!newEmail || !newEmail.endsWith('@adiuniversity.com')) {
          return res.status(400).json({ error: 'Email must end with @adiuniversity.com' });
        }
        await mailboxCollection.updateOne({ id }, { $set: { email: newEmail.toLowerCase().trim(), updatedAt: new Date().toISOString() } });
      } else {
        return res.status(400).json({ error: 'Invalid action.' });
      }

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  // 5. POST /api/mail/acl - Update Directory Access Controls
  app.post('/api/mail/acl', async (req, res) => {
    try {
      const user = req.user;
      if (!user || user.role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required.' });

      const { admin, email } = req.body || {};
      const aclCollection = db.collection('acl');

      const peopleList = (email || '').split('\n').map(e => e.trim()).filter(Boolean).map(e => ({ email: e }));
      await aclCollection.updateOne(
        { _id: 'mail_acl' },
        { $set: { admin: !!admin, people: peopleList, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );

      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });
};

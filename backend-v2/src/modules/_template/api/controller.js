const templateService = require('../service');

async function ping(req, res) {
  const data = templateService.getPing();
  res.json({ ok: true, data });
}

async function echo(req, res) {
  const msg = req.query.msg || '';
  const data = templateService.echo(msg);
  res.json({ ok: true, data });
}

module.exports = {
  ping,
  echo,
};

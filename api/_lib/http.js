function allowMethod(req, res, method = "POST") {
  if (req.method !== method) {
    res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
    return false;
  }
  return true;
}

function sendOk(res, payload = {}) {
  res.status(200).json({ success: true, ...payload });
}

function sendError(res, error, fallbackCode = 500) {
  const status = Number(error?.statusCode || error?.status || fallbackCode);
  const message = error?.message || "Unexpected server error";
  res.status(status).json({ success: false, error: message });
}

module.exports = {
  allowMethod,
  sendOk,
  sendError,
};

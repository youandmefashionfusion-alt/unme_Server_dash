const normalize = (value) => String(value || "").trim().toLowerCase();

export const RESTRICTED_ADMINS = [
  {
    mobile: "9719250693",
    email: "ujjawal@codexae.com",
    allowedFirstnames: ["ujjawal"],
  },
  {
    mobile: "8595810297",
    email: "mayank@codexae.com",
    allowedFirstnames: ["mayank", "mayank badal"],
  },
  {
    mobile: "7807178263",
    email: "divya.katiyar8697@gmail.com",
    allowedFirstnames: ["divya"],
  }
];

// Backward compatibility for places that still read a single admin object.
export const RESTRICTED_ADMIN = {
  mobile: RESTRICTED_ADMINS[0].mobile,
  firstname: RESTRICTED_ADMINS[0].allowedFirstnames[0],
  email: RESTRICTED_ADMINS[0].email,
};

const matchesRestrictedAdmin = (user = {}, allowedAdmin = {}) => {
  const mobileMatch = normalize(user?.mobile) === normalize(allowedAdmin?.mobile);
  const emailMatch = normalize(user?.email) === normalize(allowedAdmin?.email);
  if (!mobileMatch || !emailMatch) {
    return false;
  }

  const allowedFirstnames = Array.isArray(allowedAdmin?.allowedFirstnames)
    ? allowedAdmin.allowedFirstnames.map(normalize).filter(Boolean)
    : [];

  if (!allowedFirstnames.length) {
    return true;
  }

  return allowedFirstnames.includes(normalize(user?.firstname));
};

export const isRestrictedAdmin = (user = {}) => {
  if (normalize(user?.role) !== "admin") {
    return false;
  }

  return RESTRICTED_ADMINS.some((allowedAdmin) =>
    matchesRestrictedAdmin(user, allowedAdmin)
  );
};

export const normalizeRestrictedValue = normalize;

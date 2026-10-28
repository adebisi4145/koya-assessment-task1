// Any path without its own route gets the API's JSON error shape instead of an HTML 404.
const notFound = async () => Response.json({ error: "not found" }, { status: 404 });

export {
  notFound as GET,
  notFound as POST,
  notFound as PUT,
  notFound as PATCH,
  notFound as DELETE,
};

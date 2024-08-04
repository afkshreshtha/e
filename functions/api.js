exports.handler = async (event, context) => {
  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "http://localhost:3000"
    },
    body: JSON.stringify({ message: "Hello World" })
  };
  return response;
};
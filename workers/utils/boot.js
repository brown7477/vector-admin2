async function setupFunctions() {
  let count = 5;
  while (count > 0) {
    try {
      const success = await fetch('http://0.0.0.0:8288/v0/gql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query:
            '\n    mutation CreateApp($input: CreateAppInput!) {\n  createApp(input: $input) {\n    url\n  }\n}\n    ',
          variables: {
            input: {
              url: 'http://0.0.0.0:3355/background-workers',
            },
          },
        }),
      })
        .then((res) => {
          console.log('setupFunctions success!', res.status);
          return true;
        })
        .catch((e) => {
          console.error('setupFunctions failed', e.message);
          return false;
        });
      if (success) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
    count -= 1;
  }
  return;
}

module.exports = {
  setupFunctions,
};

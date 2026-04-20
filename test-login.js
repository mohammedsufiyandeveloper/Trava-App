const fetch = require('node:fetch');

async function testSignIn() {
    console.log("Attempting sign in to test Better Auth response headers...");
    const res = await fetch("http://192.168.1.12:3000/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "sufiyan@gmail.com", password: "password123" }) // Dummy
    });

    console.log("Status:", res.status);
    console.log("Headers:");
    res.headers.forEach((value, name) => {
        console.log(name, ":", value);
    });

    const text = await res.text();
    console.log("Body:", text);
}

testSignIn();

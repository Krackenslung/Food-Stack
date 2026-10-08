async function login() {
  const username = document.getElementById("txtUsername").value.trim();
  const password = document.getElementById("txtPassword").value.trim();

  if (!username || !password) {
    Swal.fire("Error", "Username and password are required", "warning");
    return;
  }

  try {
    const response = await fetch("http://127.0.0.1:5010/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        username: username,
        password: password
      })
    });

    const data = await response.json();

    if (!response.ok || data.status !== 0) {
      Swal.fire("Login failed", data.errorMessage || "Invalid credentials", "error");
      return;
    }

    Swal.fire({
      icon: "success",
      title: "Login successful",
      timer: 1200,
      showConfirmButton: false
    });

    setTimeout(() => {
      window.location.href = "/static/home.html";  
    }, 1200);

  } catch (error) {
    console.error(error);
    Swal.fire("Error", "Cannot connect to server", "error");
  }
}

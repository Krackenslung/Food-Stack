fetch("http://127.0.0.1:5002/users", { 
    method: "GET",
    credentials: "include" // 👈 MUY IMPORTANTE (envía auth_token)
})
.then(response => {
    if (!response.ok) {
        throw new Error("Error HTTP: " + response.status);
    }
    return response.json();
})
.then(data => {
    const tbody = document.getElementById("datatable");
    tbody.innerHTML = "";

    data.data.forEach(user => {
        tbody.innerHTML += `
            <tr>
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>${user.lastname}</td>
                <td>${user.phone}</td>
                <td>${user.dateOfBirth}</td>
                <td>${user.username}</td>
                <td>${user.status}</td>
            </tr>
        `;
    });
})
.catch(error => {
    document.getElementById("datatable").innerHTML = `
        <tr>
            <td colspan="7">Error loading data... ${error.message}</td>
        </tr>
    `;
    console.error(error);
});

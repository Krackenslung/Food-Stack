let map;
let markers = [];
let geocoder;
let marker = null; 

function initMap() {
    // GET CURRENT LOCATION
    if (!navigator.geolocation) {
        alert("Tu navegador no soporta la geolocalizacion");
        return;
    }

    geocoder = new google.maps.Geocoder();

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            showmap(lat, lng);
            loadLocations();
        }
    );
}

function showmap(lat, lng) {
    //cordenadas
    const currentLocation = { lat: lat, lng: lng };

    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 15,
        center: currentLocation
    });
    // show marker
    new google.maps.Marker({
        position: currentLocation,
        map: map,
        title: "My current location",
        icon: {
            url: "https://www.freeiconspng.com/uploads/laptop-icon-png-25.png",
            scaledSize: new google.maps.Size(50, 50)
        }
    });

    // click on map
    map.addListener("click", (event) => {
        placeMarker(event.latLng);
        getAddress(event.latLng); 
    });
}

// show location
let placeMarker = function (location) {
    if (marker) {
        marker.setPosition(location);
    } else {
        //create new marker
        marker = new google.maps.Marker({
            position: location,
            map: map,
            title: "Selected location"
        });

        // Draw info window
        infoWindows = new google.maps.infoWindows({
            content: 'q'
        })

        let isOpen = false;
        marker.addListener("click", () => {
            if(isOpen){
                infoWindows.close();
                isOpen = false;
            } else {
                infoWindows.open(map,marker);
                isOpen = true;
            }
        })
    }
};

// get address 
function getAddress(latLng) {
    geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === "OK" && results[0]) {
            const fullAddress = results[0].formatted_address;
            console.log("Full address:", fullAddress);

            const addressInput = document.getElementById("address");
            if (addressInput) {
                addressInput.value = fullAddress;
            }
        } else {
            console.error("Geocoder failed:", status);
        }
    });
}

function saveLocation() {
    if (!marker) {
        alert("Select a location on the map first");
        return;
    }

    const name = document.getElementById("name").value;
    const description = document.getElementById("description").value;
    const address = document.getElementById("address").value;

    const lat = marker.getPosition().lat();
    const lng = marker.getPosition().lng();

    const token = localStorage.getItem("token");

    fetch("http://127.0.0.1:5002/locations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
            name,
            description,
            address,
            lat,
            lng
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.status === 0) {
            alert("Location saved ✅");
        } else {
            alert(data.errorMessage || "Error saving");
        }
    })
    .catch(err => {
        console.error(err);
        alert("Server error");
    });
}

//load addresses 
function loadLocations() {
  fetch("http://127.0.0.1:5002/locations")
    .then(response => {
      if (!response.ok) {
        throw new Error("Server response error");
      }
      return response.json();
    })
    .then(data => {
      console.log("API response:", data);

      let locations = [];

      if (Array.isArray(data)) {
        locations = data;
      } else if (Array.isArray(data.locations)) {
        locations = data.locations;
      } else if (Array.isArray(data.data)) {
        locations = data.data;
      } else {
        console.error("API has no locations:", data);
        return;
      }

      markers.forEach(m => m.setMap(null));
      markers = [];

      locations.forEach(loc => {
        const m = new google.maps.Marker({
          position: {
            lat: parseFloat(loc.lat),
            lng: parseFloat(loc.lng)
          },
          map: map,
          title: loc.description || loc.name || "Location"
        });

        // Draw info window
        infoWindows = new google.maps.infoWindows({
            content: 'bootstrap design with name, description, address'
        })

        let isOpen = false;
        marker.addListener("click", () => {
            if(isOpen){
                infoWindows.close();
                isOpen = false;
            } else {
                infoWindows.open(map,marker);
                isOpen = true;
            }
        })

        markers.push(m);
      });
    })
    .catch(error => {
      console.error("Error loading locations:", error);
    });
}



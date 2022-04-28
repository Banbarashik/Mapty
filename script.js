'use strict';

// prettier-ignore
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const form = document.querySelector('.form');
const sortByPanel = document.querySelector('.workouts__sorting');
const btnDeleteWorkouts = document.querySelector('.workouts__delete');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const errMessage = document.querySelector('.form__err_message');

class Workout {
  date = new Date();
  id = Date.now() + '';

  constructor(distance, duration, coords) {
    this.distance = distance;
    this.duration = duration;
    this.coords = coords;
  }

  _createDescription() {
    this.description = `${this.type[0].toUpperCase() + this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(distance, duration, coords, cadence) {
    super(distance, duration, coords);
    this.cadence = cadence;
    this.calcPace();

    this._createDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(distance, duration, coords, elevationGain) {
    super(distance, duration, coords);
    this.elevationGain = elevationGain;
    this.calcSpeed();

    this._createDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
  }
}

class App {
  #workouts = [];
  #markers = [];

  #map;
  #mapEvent;
  #mapZoomLevel = 13;

  createWorkoutLinked = this._createWorkout.bind(this);
  editWorkoutLinked;

  #formMode = 'add';

  constructor() {
    this._getLocalStorage();
    this._getPosition();

    // Event handlers
    sortByPanel.addEventListener('click', this._sortWorkouts.bind(this));
    btnDeleteWorkouts.addEventListener(
      'click',
      this._deleteAllWorkouts.bind(this)
    );

    containerWorkouts.addEventListener('click', this._moveToMarker.bind(this));
    containerWorkouts.addEventListener(
      'click',
      this._changeWorkoutValues.bind(this)
    );
    containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));

    form.addEventListener('submit', this.createWorkoutLinked);
    form.addEventListener('keydown', this._hideErrMessage);

    inputType.addEventListener('change', this._toggleElevationField);
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert("Couldn't get your current position");
        }
      );
    }
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => this._renderWorkoutMarker(work));
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;

    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // prettier-ignore
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';

    form.style.display = 'none';
    setTimeout(() => (form.style.display = 'grid'), 1000); // an abrupt form closing
    form.classList.add('hidden');

    containerWorkouts.prepend(form);
  }

  _showErrMessage() {
    errMessage.classList.remove('hidden');
    form.classList.add('error');
  }

  _hideErrMessage() {
    errMessage.classList.add('hidden');
    form.classList.remove('error');
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _processWorkoutValues(lat, lng, obj) {
    const isNumber = (...inputs) =>
      inputs.every(input => Number.isFinite(input));
    const isPositiveNumber = (...inputs) => inputs.every(input => input > 0);

    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;

    if (type === 'running') {
      const cadence = +inputCadence.value;

      if (
        !isNumber(distance, duration, cadence) ||
        !isPositiveNumber(distance, duration, cadence)
      ) {
        this._showErrMessage();
        return;
      }

      if (this.#formMode === 'add') {
        return new Running(distance, duration, [lat, lng], cadence);
      }

      if (this.#formMode === 'edit') {
        obj.type = type;
        obj.distance = distance;
        obj.duration = duration;
        obj.cadence = cadence;
      }
    }

    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !isNumber(distance, duration, elevation) ||
        !isPositiveNumber(distance, duration)
      ) {
        this._showErrMessage();
        return;
      }

      if (this.#formMode === 'add') {
        return new Cycling(distance, duration, [lat, lng], elevation);
      }

      if (this.#formMode === 'edit') {
        obj.type = type;
        obj.distance = distance;
        obj.duration = duration;
        obj.elevationGain = elevation;
      }
    }
  }

  _createWorkout(e) {
    e?.preventDefault();

    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    workout = this._processWorkoutValues(lat, lng);

    // stop execution if some input value is invalid
    if (form.classList.contains('error')) return;

    // save new workout in array
    this.#workouts.push(workout);

    // show marker and popup
    this._renderWorkoutMarker(workout);

    // show item in the sidebar
    this._renderWorkoutItem(workout);

    // hide form after workout is added
    this._hideForm();

    // save workouts array in localStorage
    this._setLocalStorage();
  }

  _updateWorkoutMarker(workout) {
    const marker = this.#markers.find(
      marker => marker.options.id === workout.id
    );
    marker
      .closePopup()
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♂️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords, { id: workout.id })
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♂️'} ${workout.description}`
      )
      .openPopup();

    this.#markers.push(marker);
  }

  _renderWorkoutItem(workout) {
    let html = `
    <li class="workout workout--${
      workout.type === 'running' ? 'running' : 'cycling'
    }" data-id="${workout.id}">
      <div class="workout__icons">
      <img src="trash-outline.svg" class="workout__delete">
      <img src="settings-outline.svg" class="workout__settings">
      </div>
      <h2 class="workout__title">${workout.description}</h2>
      <div class="workout__details">
        <span class="workout__icon">${
          workout.type === 'running' ? '🏃‍♂️' : '🚴‍♂️'
        }</span>
        <span class="workout__value">${workout.distance}</span>
        <span class="workout__unit">km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
      </div>
    `;

    if (workout.type === 'running') {
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.pace.toFixed(1)}</span>
        <span class="workout__unit">min/km</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">👣</span>
        <span class="workout__value">${workout.cadence}</span>
        <span class="workout__unit">spm</span>
      </div>
    </li>
      `;
    }

    if (workout.type === 'cycling') {
      html += `
      <div class="workout__details">
        <span class="workout__icon">⚡️</span>
        <span class="workout__value">${workout.speed.toFixed(1)}</span>
        <span class="workout__unit">km/h</span>
      </div>
      <div class="workout__details">
        <span class="workout__icon">⛰</span>
        <span class="workout__value">${workout.elevationGain}</span>
        <span class="workout__unit">m</span>
      </div>
    </li>
      `;
    }

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToMarker(e) {
    if (e.target.classList.contains('workout__settings')) return;

    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _editWorkout(workout, e) {
    // this = App
    // workout = workoutObj
    e.preventDefault();

    workout.type = inputType.value;

    if (workout.type === 'running') {
      Object.setPrototypeOf(workout, Running.prototype);
      workout.description = workout.description.replace('Cycling', 'Running');
      workout.calcPace();
    } else {
      Object.setPrototypeOf(workout, Cycling.prototype);
      workout.description = workout.description.replace('Running', 'Cycling');
      workout.calcSpeed();
    }

    // change values of the current workout
    this._processWorkoutValues(null, null, workout);

    // stop execution if some input value is invalid
    if (form.classList.contains('error')) return;

    this._updateWorkoutMarker(workout);
    this._renderWorkoutItem(workout);
    this._setLocalStorage();

    form.removeEventListener('submit', this.editWorkoutLinked);
    form.addEventListener('submit', this.createWorkoutLinked);
    this.#formMode = 'add';

    this._removeHiddenWorkout();
    this._hideForm();
  }

  _changeWorkoutValues(e) {
    if (!e.target.classList.contains('workout__settings')) return;

    if (this.#formMode === 'edit') {
      form.removeEventListener('submit', this.editWorkoutLinked);
    }

    this.#formMode = 'edit';

    this._hideErrMessage();

    Array.from(containerWorkouts.children).forEach(child =>
      child.classList.remove('hidden')
    );

    const workoutItem = e.target.closest('.workout');
    const workoutObj = this.#workouts.find(
      work => work.id === workoutItem.dataset.id
    );

    form.classList.remove('hidden');
    workoutItem.classList.add('hidden');
    containerWorkouts.insertBefore(form, workoutItem);

    inputType.value = workoutObj.type;
    inputDistance.value = workoutObj.distance;
    inputDuration.value = workoutObj.duration;

    // the condition prevents an input from becoming undefined
    if (workoutObj.type === 'running') {
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.value = workoutObj.cadence;
    }
    if (workoutObj.type === 'cycling') {
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation.value = workoutObj.elevationGain;
    }

    this.editWorkoutLinked = this._editWorkout.bind(this, workoutObj);

    form.removeEventListener('submit', this.createWorkoutLinked);
    form.addEventListener('submit', this.editWorkoutLinked);
  }

  _deleteWorkout(e) {
    if (!e.target.classList.contains('workout__delete')) return;

    const workoutEl = e.target.closest('.workout');

    const workoutIndex = this.#workouts.findIndex(
      work => work.id === workoutEl.dataset.id
    );

    const marker = this.#markers.find(
      marker => marker.options.id === workoutEl.dataset.id
    );

    this.#workouts.splice(workoutIndex, 1);
    workoutEl.remove();
    marker.remove();

    this._setLocalStorage();
  }

  _deleteAllWorkouts(e) {
    e.preventDefault();

    this.#workouts = [];

    Array.from(containerWorkouts.children).forEach(work => {
      if (work.classList.contains('form')) return;

      work.remove();
    });

    this.#markers.forEach(marker => marker.remove());

    this._setLocalStorage();
  }

  _sortWorkouts(e) {
    if (e.target.tagName !== 'INPUT') return;

    const fieldToSortBy = e.target.value;

    const sortedWorkouts = this.#workouts
      .slice()
      .sort((workA, workB) => workA[fieldToSortBy] - workB[fieldToSortBy]);

    Array.from(containerWorkouts.children).forEach(work => {
      if (work.classList.contains('form')) return;

      work.remove();
    });

    sortedWorkouts.forEach(work => this._renderWorkoutItem(work));

    this._hideErrMessage();
    this._hideForm();
  }

  _removeHiddenWorkout() {
    Array.from(containerWorkouts.children)
      .find(
        work =>
          work.classList.contains('hidden') &&
          work.classList.contains('workout')
      )
      .remove();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = localStorage.getItem('workouts');

    if (!data) return;

    this.#workouts = JSON.parse(data);
    console.log(this.#workouts);

    this.#workouts.forEach(work => {
      let restoredWorkout;

      if (work.type === 'running') {
        restoredWorkout = Object.assign(new Running(), work);
      } else {
        restoredWorkout = Object.assign(new Cycling(), work);
      }
      this._renderWorkoutItem(restoredWorkout);
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();

import React, {useState} from 'react';
import { ToastContainer, toast, Bounce } from 'react-toastify';
// import 'react-toastify/dist/ReactToastify.css';
const settingLabels = {
  isPrivateGame: 'Game Type',
  numOfWords: 'Number of Questions',
  timePerQuestion: 'Time per Question',
};

export default function ConfigOptions(props) {
  const { roomId, socket } = props;
  const [startPressed, setStartPressed] = useState(false);

  const handleConfigChange = (setting, value) => {
    
    socket.emit('update_config', roomId, { [setting]: value });
    const label = settingLabels[setting] || setting;
    if (setting === 'isPrivateGame') {
      value = value ? 'Private' : 'Public';
    } else if (setting === 'numOfWords') {
      value = `${value} words`;
    } else if (setting === 'timePerQuestion') {
      value = `${value} sec`;
    }
    console.log(`Updated: ${setting} = ${value}`);
    toast.info(<span><b>{label}</b> = {value}</span>, {
      position: "top-center",
      autoClose: 1000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: true,
      progress: undefined,
      theme: "colored",
      transition: Bounce,
    });
  };

  const startGame = (e) => {
    e.preventDefault();
    if (startPressed) return;
    setStartPressed(true);
    
    socket.emit('start_game', roomId, false, (response) => {
      setStartPressed(false);
      if (response.success) {
        toast.success('Game started!', {
          position: "top-center",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: true,
          progress: undefined,
          theme: "colored",
          transition: Bounce,
        });
      }
    });
  };

  // Tailwind‑friendly helper for radio groups
  const RadioGroup = ({ legend, options, name, onChange, defaultValue, formatLabel }) => (
    <fieldset className="mb-4">
      <legend className="text-blue-800 font-medium mb-2">{legend}</legend>
      <div className="flex space-x-6">
        {options.map(opt => (
          <label key={opt.value} className="inline-flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={opt.value}
              defaultChecked={opt.value === defaultValue}
              onChange={() => onChange(opt.value)}
              className="form-radio text-blue-600 h-5 w-5"
            />
            <span className="text-blue-900">{formatLabel ? formatLabel(opt.value) : opt.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
      <h3 className="text-xl font-semibold text-blue-900 mb-4">
        Game Configuration
      </h3>
      <form onSubmit={startGame} className="space-y-4">
        {/* Number of words */}
        <RadioGroup
          legend="Number of words"
          name="num_of_words"
          options={[
            { value: 1, label: '1 word' },
            { value: 3, label: '3 words' },
            { value: 5, label: '5 words' },
          ]}
          defaultValue={3}
          onChange={(val) => handleConfigChange('numOfWords', val)}
        />

        {/* Time per question */}
        <RadioGroup
          legend="Time per Question"
          name="time_per_question"
          options={[1, 2, 3].map(n => ({ value: n, label: `${n} min` }))}
          defaultValue={1}
          onChange={(val) => handleConfigChange('timePerQuestion', val)}
        />

        {/* Private game */}
        <RadioGroup
          legend="Private Game?"
          name="private_game"
          options={[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ]}
          defaultValue={true}
          formatLabel={(v) => (v ? 'Yes' : 'No')}
          onChange={(val) => handleConfigChange('isPrivateGame', val)}
        />

        <button
          type="submit"
          className="w-full mt-4 bg-blue-800 text-white py-2 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          Start Game
        </button>
      </form>
    </div>
  );
}

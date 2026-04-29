import droneGif from '../assets/drone-with-parcel.gif';
import robotGif from '../assets/happy-retro-robot.gif';
import './Illustration.css';

interface IllustrationProps {
  type: 'drone' | 'robot';
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export const Illustration = ({ type, className = '', size = 'medium' }: IllustrationProps) => {
  const gifSrc = type === 'drone' ? droneGif : robotGif;

  const sizeClasses = {
    small: 'illustration-small',
    medium: 'illustration-medium',
    large: 'illustration-large'
  };

  return (
    <img
      src={gifSrc}
      alt={`${type} illustration`}
      className={`illustration ${sizeClasses[size]} ${className}`}
    />
  );
};
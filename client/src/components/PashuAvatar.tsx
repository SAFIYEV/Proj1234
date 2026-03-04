import React from 'react';
import { User, ItemType } from '../types';
import { SLOT_POSITIONS } from '../utils/constants';
import { useItemsStore } from '../stores/useItemsStore';
import pashaAvatar from '../../assets/avatars/pasha-avatar_test.png';

interface PashuAvatarProps {
  user: User;
  onSlotClick: (type: ItemType) => void;
}

export const PashuAvatar: React.FC<PashuAvatarProps> = ({ user, onSlotClick }) => {
  const { setSelectedType } = useItemsStore();

  const handleSlotClick = (type: ItemType) => {
    setSelectedType(type);
    onSlotClick(type);
  };

  const getEquippedItem = (type: ItemType) => {
    return user.items.find(userItem => userItem.item.type === type && userItem.equipped);
  };

  // Функция для рендера слота
  const renderSlot = (slot: any) => {
    const equippedUserItem = getEquippedItem(slot.id);
    
    return (
      <div key={slot.id} className="flex flex-col items-center relative">
        <button
          onClick={() => handleSlotClick(slot.id)}
          className="border-2 w-[15vw] h-[15vw] min-w-12 min-h-12 max-w-20 max-h-20 bg-white bg-opacity-10 block rounded-2xl shadow-lg hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center"
          style={{
            backgroundImage: equippedUserItem?.item.imageUrl ? `url(${equippedUserItem.item.imageUrl})` : 'none',
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
          title={slot.name}
        >
          {!equippedUserItem && (
            <span className="text-gray-400 text-sm font-light">
              {slot.id === ItemType.CAP && '🧢'}
              {slot.id === ItemType.GLASSES && '👓'}
              {slot.id === ItemType.NECKLACE && '💎'}
              {slot.id === ItemType.UNDERWEAR && '🩲'}
              {slot.id === ItemType.RING && '💍'}
              {slot.id === ItemType.SOCKS && '🧦'}
              {slot.id === ItemType.SHIRT && '👕'}
              {slot.id === ItemType.PANTS && '👖'}
              {slot.id === ItemType.SHOES && '👟'}
            </span>
          )}
        </button>
        
        <div className="mt-2 text-xs text-white font-light bg-black bg-opacity-50 px-2 py-1 rounded-lg whitespace-nowrap" style={{ fontFamily: 'Montserrat, sans-serif' }}>
          {slot.name}
        </div>
      </div>
    );
  };

  // Группировка слотов по позициям
  const topSlots = SLOT_POSITIONS.filter(slot => 
    slot.id === ItemType.CAP || slot.id === ItemType.GLASSES || slot.id === ItemType.NECKLACE
  );

  const leftSlots = SLOT_POSITIONS.filter(slot => 
    slot.id === ItemType.RING || slot.id === ItemType.SHIRT || slot.id === ItemType.UNDERWEAR
  );

  const rightSlots = SLOT_POSITIONS.filter(slot => 
    slot.id === ItemType.SOCKS || slot.id === ItemType.PANTS || slot.id === ItemType.SHOES
  );

  return (
    <div className="w-full h-full flex flex-col">
      {/* Верхний ряд из трёх слотов */}
      <div className="flex justify-center space-x-4 py-4">
        {topSlots.map(renderSlot)}
      </div>
      
      {/* Основная область с фоном Паши и боковыми слотами */}
      <div 
        className="flex-1 flex items-center justify-between px-4 relative"
        style={{
          backgroundImage: `url(${pashaAvatar})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        {/* Левая колонка из трёх айтемов */}
        <div className="flex flex-col space-y-4 z-10">
          {leftSlots.map(renderSlot)}
        </div>
        
        {/* Центральная невидимая область для сохранения пропорций */}
        <div className="flex-1" />
        
        {/* Правая колонка из трёх айтемов */}
        <div className="flex flex-col space-y-4 z-10">
          {rightSlots.map(renderSlot)}
        </div>
      </div>
    </div>
  );
};

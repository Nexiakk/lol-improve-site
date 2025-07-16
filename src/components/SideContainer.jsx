// src/components/SideContainer.jsx
import React, { useState } from "react";
import { PinOff, ChevronUp, Edit, CheckCircle, Trash2, Plus } from "lucide-react";
import { Modal, Select, Input, Button } from "antd";

const PreGameFocusSkeleton = () => (
  <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <div className="h-4 bg-gray-700 rounded w-32"></div>
      </div>
      <div className="w-7 h-7 bg-gray-700 rounded-md"></div>
    </div>
  </div>
);

const SideContainer = ({ isLoading, activePreGameGoals, handleRemovePreGameGoal, goalTemplates, selectedPreGameTemplateId, setSelectedPreGameTemplateId, customPreGameGoalText, setCustomPreGameGoalText, handleAddPreGameGoal }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [tempSelectedTemplate, setTempSelectedTemplate] = useState("");
  const [tempCustomText, setTempCustomText] = useState("");

  const commonInputClass = "w-full bg-gray-700/80 border border-gray-600 rounded-md shadow-sm focus:border-orange-500 text-gray-200 placeholder-gray-400 text-xs px-2.5";
  const controlElementHeightClass = "h-9";

  const containerClasses = "relative bg-gray-900/60 p-4 rounded-lg border border-gray-700/50 backdrop-blur-sm";

  const handleOpenModal = () => {
    setIsModalVisible(true);
    setTempSelectedTemplate("");
    setTempCustomText("");
  };

  const handleCloseModal = () => {
    setIsModalVisible(false);
    setTempSelectedTemplate("");
    setTempCustomText("");
  };

  const handleSubmitGoal = () => {
    if (tempSelectedTemplate) {
      // Set the template ID and clear custom text
      setSelectedPreGameTemplateId(tempSelectedTemplate);
      setCustomPreGameGoalText("");
      // Pass the current template ID directly
      handleAddPreGameGoal(tempSelectedTemplate, null);
    } else if (tempCustomText.trim()) {
      // Set the custom text and clear template ID
      setCustomPreGameGoalText(tempCustomText.trim());
      setSelectedPreGameTemplateId("");
      // Pass the current custom text directly
      handleAddPreGameGoal(null, tempCustomText.trim());
    }

    handleCloseModal();
  };

  const canSubmit = tempSelectedTemplate || tempCustomText.trim();

  if (isLoading) {
    return (
      <div className={containerClasses}>
        {/* Static Glow for loading state */}
        <div className="absolute top-0 left-1/3 w-full h-full bg-gradient-radial from-orange-500/10 to-transparent blur-3xl -translate-y-1/2"></div>
        <div className="relative z-10">
          <PreGameFocusSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      {/* Animated Glow Effect */}
      <div className="absolute -top-1/2 -left-1/4 w-full h-full bg-gradient-radial from-orange-500/20 to-transparent blur-3xl animate-pulse opacity-70 z-0"></div>

      <div className="relative z-10">
        {/* Pre-Game Focus Section */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Pre-Game Focus</h3>
            <button onClick={handleOpenModal} className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 hover:text-orange-300 flex items-center justify-center transition-all duration-150" title="Add Pre-Game Focus">
              <Plus size={18} />
            </button>
          </div>

          <div className="bg-gray-800/50 p-2 rounded-lg border border-gray-700/50 min-h-[120px] flex">
            <div className="flex-1 min-w-0">
              {activePreGameGoals && activePreGameGoals.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {activePreGameGoals.map((goal) => (
                    <div key={goal.id} className="bg-gray-900/60 p-2 rounded-md border border-gray-700/50 hover:border-orange-500/50 transition-all duration-150">
                      <div className="flex flex-col">
                        <p className="text-orange-300 font-semibold text-xs break-words mb-1" title={goal.text}>
                          {goal.text}
                        </p>
                        <div className="flex items-center justify-between">
                          {goal.category && <span className="text-gray-500 text-[10px] uppercase tracking-wider">{goal.category}</span>}
                          <button onClick={() => handleRemovePreGameGoal(goal.id)} className="p-1 text-red-600 hover:text-red-400 flex-shrink-0 rounded-full hover:bg-red-500/10 transition-all duration-150" title="Remove Goal">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <span className="text-xs text-gray-400">No active focus.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Ant Design Modal for adding goals */}
        <Modal
          title="Add Pre-Game Focus"
          open={isModalVisible}
          onCancel={handleCloseModal}
          footer={[
            <Button key="cancel" onClick={handleCloseModal}>
              Cancel
            </Button>,
            <Button key="submit" type="primary" onClick={handleSubmitGoal} disabled={!canSubmit}>
              Add Focus
            </Button>,
          ]}
          width={500}
          className="dark-modal"
        >
          <div className="space-y-3">
            {goalTemplates && goalTemplates.length > 0 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Select from templates</label>
                  <Select
                    placeholder="Choose a template..."
                    value={tempSelectedTemplate}
                    onChange={(value) => {
                      setTempSelectedTemplate(value);
                      if (value) setTempCustomText("");
                    }}
                    style={{ width: "100%" }}
                    className="dark-select"
                  >
                    {goalTemplates.map((t) => (
                      <Select.Option key={t.id} value={t.id.toString()}>
                        {t.title} ({t.category || "General"})
                      </Select.Option>
                    ))}
                  </Select>
                </div>

                <div className="text-center">
                  <span className="text-xs text-gray-400">OR</span>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Custom focus</label>
              <Input
                placeholder="Type your custom focus..."
                value={tempCustomText}
                onChange={(e) => {
                  setTempCustomText(e.target.value);
                  if (e.target.value) setTempSelectedTemplate("");
                }}
                className="dark-input"
              />
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};
SideContainer.displayName = "SideContainer";
export default SideContainer;
